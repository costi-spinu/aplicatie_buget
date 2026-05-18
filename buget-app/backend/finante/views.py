from datetime import date, timedelta
import secrets
from django.db.models.functions import TruncDate
from django.db.models import Sum, Q
from django.contrib.auth.models import User
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
import calendar
from calendar import monthrange

from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser

from .models import (
    EmailChangeRequest,
    RealizariTarget,
    SalarySchedule,
    UserProfile,
    Venit,
    CheltuialaFixa,
    CheltuialaVariabila,
    EconomieVacanta,
    EconomieLunara,
    MiscareFond,
    Fond,
    UserBridge,
)

from .serializers import (
    RegisterSerializer,
    VenitSerializer,
    CheltuialaFixaSerializer,
    CheltuialaVariabilaSerializer,
    EconomieVacantaSerializer,
    EconomieLunaraSerializer,
    MiscareFondSerializer,
    FondSerializer,
    RealizariTargetSerializer,
    UserProfileSerializer,
)

from .utils import get_luna_bugetara
from .utils_users import get_connected_user_ids


class BaseViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user_ids = get_connected_user_ids(self.request.user)
        return self.queryset.filter(user_id__in=user_ids)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class VenitViewSet(BaseViewSet):
    queryset = Venit.objects.all()
    serializer_class = VenitSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        archived = self.request.query_params.get("archived")
        if archived == "1":
            return queryset[10:]
        if archived == "0":
            return queryset[:10]
        return queryset


class CheltuialaFixaViewSet(BaseViewSet):
    queryset = CheltuialaFixa.objects.all()
    serializer_class = CheltuialaFixaSerializer


class CheltuialaVariabilaViewSet(BaseViewSet):
    queryset = CheltuialaVariabila.objects.all()
    serializer_class = CheltuialaVariabilaSerializer


class EconomieVacantaViewSet(BaseViewSet):
    queryset = EconomieVacanta.objects.all()
    serializer_class = EconomieVacantaSerializer



def sync_salary_income(user):
    today = timezone.localdate()
    for schedule in user.salary_schedules.filter(activ=True):
        target_day = min(schedule.zi, calendar.monthrange(today.year, today.month)[1])
        income_date = date(today.year, today.month, target_day)
        Venit.objects.update_or_create(
            user=user,
            salary_schedule=schedule,
            data=income_date,
            defaults={
                "suma": schedule.suma,
                "moneda": schedule.moneda,
                "sursa": "salariu",
            },
        )


def serialize_profile_response(user):
    profile, _ = UserProfile.objects.get_or_create(user=user)
    sync_salary_income(user)
    data = UserProfileSerializer(profile).data
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "profile": data,
    }


@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def profile(request):
    profile_obj, _ = UserProfile.objects.get_or_create(user=request.user)

    if request.method == "GET":
        return Response(serialize_profile_response(request.user))

    username = request.data.get("username")
    if username:
        exists = User.objects.exclude(id=request.user.id).filter(username=username).exists()
        if exists:
            return Response({"username": "Acest username există deja."}, status=400)
        request.user.username = username
        request.user.save(update_fields=["username"])

    serializer = UserProfileSerializer(profile_obj, data=request.data.get("profile", {}), partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    serializer.save()
    sync_salary_income(request.user)
    return Response(serialize_profile_response(request.user))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):
    old_password = request.data.get("old_password", "")
    new_password = request.data.get("new_password", "")
    confirm_password = request.data.get("confirm_password", "")

    if not request.user.check_password(old_password):
        return Response({"old_password": "Parola veche este incorectă."}, status=400)
    if new_password != confirm_password:
        return Response({"confirm_password": "Parolele noi nu coincid."}, status=400)
    if len(new_password) < 6:
        return Response({"new_password": "Parola nouă trebuie să aibă minimum 6 caractere."}, status=400)

    request.user.set_password(new_password)
    request.user.save(update_fields=["password"])
    return Response({"success": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def request_email_change(request):
    new_email = request.data.get("new_email", "").strip().lower()
    password = request.data.get("password", "")

    if not request.user.check_password(password):
        return Response({"password": "Parola este incorectă."}, status=400)
    if not new_email:
        return Response({"new_email": "Email-ul nou este obligatoriu."}, status=400)
    if User.objects.exclude(id=request.user.id).filter(email__iexact=new_email).exists():
        return Response({"new_email": "Email-ul este deja folosit."}, status=400)

    code = secrets.token_urlsafe(24)
    EmailChangeRequest.objects.create(user=request.user, new_email=new_email, code=code)
    link = request.build_absolute_uri(f"/api/email-change/confirm/{code}/")

    send_mail(
        "Confirmare modificare email",
        f"Codul tău de confirmare este: {code}\nLink confirmare: {link}",
        getattr(settings, "DEFAULT_FROM_EMAIL", settings.EMAIL_HOST_USER),
        [new_email],
        fail_silently=True,
    )

    return Response({"success": True, "message": "Am trimis linkul și codul de confirmare pe emailul nou."})


@api_view(["POST", "GET"])
@permission_classes([AllowAny])
def confirm_email_change(request, code=None):
    provided_code = code or request.data.get("code")
    try:
        change = EmailChangeRequest.objects.get(code=provided_code, used_at__isnull=True)
    except EmailChangeRequest.DoesNotExist:
        return Response({"code": "Cod invalid sau deja folosit."}, status=400)

    change.user.email = change.new_email
    change.user.save(update_fields=["email"])
    change.used_at = timezone.now()
    change.save(update_fields=["used_at"])
    return Response({"success": True, "email": change.user.email})


class RealizariTargetViewSet(BaseViewSet):
    queryset = RealizariTarget.objects.all()
    serializer_class = RealizariTargetSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def create(self, request, *args, **kwargs):
        luna = request.data.get("luna")
        instance = RealizariTarget.objects.filter(user=request.user, luna=luna).first()
        if instance:
            serializer = self.get_serializer(instance, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
            return Response(serializer.data)
        return super().create(request, *args, **kwargs)

class RegisterView(APIView):
    permission_classes = []

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(
                {"message": "Cont creat cu succes"},
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class FondViewSet(BaseViewSet):
    queryset = Fond.objects.all()
    serializer_class = FondSerializer


def perioada_bugetara(ref_date=None):
    if not ref_date:
        ref_date = date.today()

    if ref_date.day >= 26:
        start = ref_date.replace(day=26)
        end = (start.replace(day=1) + timedelta(days=32)).replace(day=25)
    else:
        end = ref_date.replace(day=25)
        start = (end.replace(day=1) - timedelta(days=1)).replace(day=26)

    return start, end


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def venit_total_lunar(request):
    today = date.today()

    start = date(today.year, today.month, 1)
    last_day = monthrange(today.year, today.month)[1]
    end = date(today.year, today.month, last_day)

    user_ids = get_connected_user_ids(request.user)

    total = (
        Venit.objects.filter(
            user_id__in=user_ids,
            data__gte=start,
            data__lte=end,
        ).aggregate(total=Sum("suma"))["total"]
        or 0
    )

    return Response(
        {
            "start": start,
            "end": end,
            "venit_total": total,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    user = request.user
    return Response(
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "profile": serialize_profile_response(user).get("profile"),
            "is_admin": user.is_staff or user.is_superuser,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def buget_lunar(request):
    start, end = perioada_bugetara()
    user_ids = get_connected_user_ids(request.user)

    venit = (
        Venit.objects.filter(
            user_id__in=user_ids,
            data__range=(start, end),
        ).aggregate(
            total=Sum("suma")
        )["total"]
        or 0
    )

    total_fixe = (
        CheltuialaFixa.objects.filter(
            user_id__in=user_ids,
            data__range=(start, end),
        ).aggregate(total=Sum("suma"))["total"]
        or 0
    )

    total_variabile = (
        CheltuialaVariabila.objects.filter(
            user_id__in=user_ids,
            data__range=(start, end),
        ).aggregate(total=Sum("suma"))["total"]
        or 0
    )

    total_cheltuieli = total_fixe + total_variabile

    return Response(
        {
            "luna": f"{start} – {end}",
            "venit": venit,
            "cheltuieli": total_cheltuieli,
            "fixe": total_fixe,
            "variabile": total_variabile,
            "economii": venit - total_cheltuieli,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def grafice_luna(request):
    start, end = perioada_bugetara()
    user_ids = get_connected_user_ids(request.user)

    cheltuieli = (
        CheltuialaVariabila.objects.filter(
            user_id__in=user_ids, data__range=(start, end)
        )
        .values("categorie")
        .annotate(total=Sum("suma"))
    )
    venit = (
        Venit.objects.filter(user_id__in=user_ids, data__range=(start, end)).aggregate(
            total=Sum("suma")
        )["total"]
        or 0
    )

    return Response(
        {
            "luna": f"{start} – {end}",
            "venit": venit,
            "cheltuieli": list(cheltuieli),
            "economii": venit - sum(c["total"] for c in cheltuieli),
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def calculeaza_economii_luna(request):
    start, end = perioada_bugetara()
    luna = f"{start.year}-{start.month:02d}"
    user_ids = get_connected_user_ids(request.user)

    venit = (
        Venit.objects.filter(
            user_id__in=user_ids,
            data__range=(start, end),
        ).aggregate(
            total=Sum("suma")
        )["total"]
        or 0
    )

    cheltuieli = (
        CheltuialaFixa.objects.filter(
            user_id__in=user_ids,
            data__range=(start, end),
        ).aggregate(total=Sum("suma"))["total"]
        or 0
    ) + (
        CheltuialaVariabila.objects.filter(
            user_id__in=user_ids,
            data__range=(start, end),
        ).aggregate(total=Sum("suma"))["total"]
        or 0
    )

    economie = venit - cheltuieli

    EconomieLunara.objects.update_or_create(
        user=request.user,  # important: nu user_id__in
        luna=luna,
        defaults={"sold": economie},
    )

    return Response(
        {
            "luna": luna,
            "venit": venit,
            "cheltuieli": cheltuieli,
            "economie": economie,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def istoric_economii(request):
    data = EconomieLunara.objects.filter(user=request.user).order_by("luna")
    serializer = EconomieLunaraSerializer(data, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def economii_vacanta_sumar(request):
    puse = (
        EconomieVacanta.objects.filter(user=request.user, tip="economii").aggregate(
            total=Sum("suma")
        )["total"]
        or 0
    )

    cheltuite = (
        CheltuialaVariabila.objects.filter(
            user=request.user, categorie="vacanta"
        ).aggregate(total=Sum("suma"))["total"]
        or 0
    )

    return Response(
        {
            "puse_deoparte": puse,
            "cheltuite": cheltuite,
            "ramase": puse - cheltuite,
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def miscare_fond(request):
    serializer = MiscareFondSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    miscare = serializer.save(user=request.user)

    # dacă e retragere, transformăm suma în negativ
    if miscare.tip == "retrage":
        if miscare.suma_eur:
            miscare.suma_eur = -abs(miscare.suma_eur)
        if miscare.suma_ron:
            miscare.suma_ron = -abs(miscare.suma_ron)
        miscare.save()

    return Response(
        MiscareFondSerializer(miscare).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(["PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def miscare_fond_detail(request, pk):
    user_ids = get_connected_user_ids(request.user)

    try:
        miscare = MiscareFond.objects.get(pk=pk, user_id__in=user_ids)
    except MiscareFond.DoesNotExist:
        return Response(
            {"detail": "Mișcarea nu există."}, status=status.HTTP_404_NOT_FOUND
        )

    if request.method == "DELETE":
        miscare.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = MiscareFondSerializer(miscare, data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    miscare = serializer.save()

    if miscare.tip == "retrage":
        if miscare.suma_eur:
            miscare.suma_eur = -abs(miscare.suma_eur)
        if miscare.suma_ron:
            miscare.suma_ron = -abs(miscare.suma_ron)
        miscare.save()
    elif miscare.tip == "adauga":
        if miscare.suma_eur:
            miscare.suma_eur = abs(miscare.suma_eur)
        if miscare.suma_ron:
            miscare.suma_ron = abs(miscare.suma_ron)
        miscare.save()

    return Response(MiscareFondSerializer(miscare).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def fonduri(request):
    user_ids = get_connected_user_ids(request.user)

    qs = MiscareFond.objects.filter(user_id__in=user_ids)

    total_eur = qs.aggregate(total=Sum("suma_eur"))["total"] or 0
    total_ron = qs.aggregate(total=Sum("suma_ron"))["total"] or 0

    serializer = MiscareFondSerializer(qs, many=True)

    return Response(
        {
            "total_eur": total_eur,
            "total_ron": total_ron,
            "miscari": serializer.data,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def fonduri_grafic(request):
    qs = MiscareFond.objects.filter(user=request.user)

    total_eur = qs.aggregate(total=Sum("suma_eur"))["total"] or 0
    total_ron = qs.aggregate(total=Sum("suma_ron"))["total"] or 0

    return Response(
        {
            "labels": ["EUR", "RON"],
            "data": [total_eur, total_ron],
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def fonduri_grafic_timeline(request):
    qs = (
        MiscareFond.objects.filter(user=request.user)
        .annotate(zi=TruncDate("data"))
        .values("zi")
        .annotate(
            eur=Sum("suma_eur"),
            ron=Sum("suma_ron"),
        )
        .order_by("zi")
    )

    labels = []
    eur = []
    ron = []

    sold_eur = 0
    sold_ron = 0

    for r in qs:
        sold_eur += r["eur"] or 0
        sold_ron += r["ron"] or 0
        labels.append(r["zi"])
        eur.append(sold_eur)
        ron.append(sold_ron)

    return Response(
        {
            "labels": labels,
            "datasets": [
                {"label": "EUR", "data": eur},
                {"label": "RON", "data": ron},
            ],
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def venit_status_lunar(request):
    user_ids = get_connected_user_ids(request.user)
    venituri = Venit.objects.filter(user_id__in=user_ids)

    luni = {}

    for v in venituri:
        start, _ = get_luna_bugetara(v.data)
        key = f"{start.year}-{start.month:02d}"
        luni.setdefault(key, 0)
        luni[key] += float(v.suma)

    labels = sorted(luni.keys())
    data = [luni[l] for l in labels]

    return Response(
        {
            "labels": labels,
            "data": data,
        }
    )


@api_view(["GET"])
@permission_classes([IsAdminUser])
def lista_utilizatori(request):
    users = User.objects.all().order_by("-date_joined")

    data = [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "is_staff": u.is_staff,
            "is_superuser": u.is_superuser,
            "date_joined": u.date_joined,
        }
        for u in users
    ]

    return Response(data)


@api_view(["PUT"])
@permission_classes([IsAdminUser])
def update_user(request, pk):
    user = User.objects.get(pk=pk)

    user.username = request.data.get("username", user.username)
    user.email = request.data.get("email", user.email)
    user.is_staff = request.data.get("is_staff", user.is_staff)
    user.is_superuser = request.data.get("is_superuser", user.is_superuser)

    user.save()

    return Response({"success": True})


@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_stats(request):
    total_venit = Venit.objects.aggregate(total=Sum("suma"))["total"] or 0

    total_cheltuieli = (
        CheltuialaFixa.objects.aggregate(total=Sum("suma"))["total"] or 0
    ) + (CheltuialaVariabila.objects.aggregate(total=Sum("suma"))["total"] or 0)

    economii = total_venit - total_cheltuieli

    return Response(
        {
            "total_venit": total_venit,
            "total_cheltuieli": total_cheltuieli,
            "economii": economii,
        }
    )


@api_view(["DELETE"])
@permission_classes([IsAdminUser])
def delete_user(request, pk):
    try:
        user = User.objects.get(pk=pk)

        # protecție – să nu se șteargă singur
        if user == request.user:
            return Response(
                {"error": "Nu te poți șterge singur"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.delete()
        return Response({"success": True})
    except User.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)


# Send request from one user to another (e.g. for sharing budget data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def send_bridge_request(request):
    to_user_id = request.data.get("user_id")

    to_user = User.objects.get(id=to_user_id)

    bridge = UserBridge.objects.create(from_user=request.user, to_user=to_user)

    return Response({"success": True})


# Accept bridge request


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def accept_bridge(request, pk):
    bridge = UserBridge.objects.get(pk=pk, to_user=request.user)
    bridge.accepted = True
    bridge.save()
    return Response({"success": True})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def lista_useri_simpli(request):
    users = User.objects.exclude(id=request.user.id)

    data = [
        {
            "id": u.id,
            "username": u.username,
        }
        for u in users
    ]

    return Response(data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def send_bridge(request):
    to_user_id = request.data.get("user_id")

    if not to_user_id:
        return Response({"error": "User required"}, status=400)

    UserBridge.objects.create(from_user=request.user, to_user_id=to_user_id)

    return Response({"success": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def accept_bridge(request, pk):
    bridge = UserBridge.objects.get(pk=pk, to_user=request.user)
    bridge.accepted = True
    bridge.save()

    return Response({"success": True})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def bridge_requests(request):
    bridges = UserBridge.objects.filter(to_user=request.user, accepted=False)

    data = [{"id": b.id, "from_user": b.from_user.username} for b in bridges]

    return Response(data)


def get_connected_user_ids(user):
    bridges = UserBridge.objects.filter(accepted=True).filter(
        Q(from_user=user) | Q(to_user=user)
    )

    connected_user_ids = []

    for bridge in bridges:
        if bridge.from_user_id == user.id:
            connected_user_ids.append(bridge.to_user_id)
        else:
            connected_user_ids.append(bridge.from_user_id)

    return [user.id] + connected_user_ids


# grafice invetitii fonduri pentru conturi  conectate (ex. eu + partener) – total și separat per user


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def fonduri_grafic_timeline_extended(request):
    user_ids = get_connected_user_ids(request.user)

    # TOTAL (toți conectați)
    qs_total = (
        MiscareFond.objects.filter(user_id__in=user_ids)
        .annotate(zi=TruncDate("data"))
        .values("zi")
        .annotate(
            eur=Sum("suma_eur"),
            ron=Sum("suma_ron"),
        )
        .order_by("zi")
    )

    def build_timeline(qs):
        labels = []
        eur = []
        ron = []

        sold_eur = 0
        sold_ron = 0

        for r in qs:
            sold_eur += r["eur"] or 0
            sold_ron += r["ron"] or 0
            labels.append(r["zi"])
            eur.append(sold_eur)
            ron.append(sold_ron)

        return {
            "labels": labels,
            "datasets": [
                {"label": "EUR", "data": eur},
                {"label": "RON", "data": ron},
            ],
        }

    total_data = build_timeline(qs_total)

    # PER USER
    per_user = {}

    users = User.objects.filter(id__in=user_ids)

    for u in users:
        qs_user = (
            MiscareFond.objects.filter(user=u)
            .annotate(zi=TruncDate("data"))
            .values("zi")
            .annotate(
                eur=Sum("suma_eur"),
                ron=Sum("suma_ron"),
            )
            .order_by("zi")
        )

        per_user[u.username] = build_timeline(qs_user)

    return Response({"total": total_data, "per_user": per_user})
