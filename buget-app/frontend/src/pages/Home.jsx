import Button from '../components/Button';
import FixToText from '../components/FixToText';
import ScreenContainer from '../components/ScreenContainer';
import Separator from '../components/Separator';
import SurfaceCard from '../components/SurfaceCard';

export default function Home({ onLoginClick }) {
  return (
    <ScreenContainer centered>
      <SurfaceCard
        style={{
          maxWidth: '420px',
          width: '100%',
          textAlign: 'center',
          borderRadius: '28px',
          padding: '40px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ fontSize: '52px', marginBottom: '20px' }}>🏡</div>

        <FixToText
          text='Aplicație de casă'
          align='center'
          fontSize='28px'
          weight={700}
        />

        <p
          style={{
            fontSize: '16px',
            color: '#636366',
            lineHeight: 1.5,
            marginBottom: '0',
          }}
        >
          Gestionare venituri, cheltuieli, economii și fonduri într-un mod simplu și elegant.
        </p>

        <Separator margin='25px 0' />

        <p style={{ fontSize: '13px', color: '#8E8E93', marginBottom: '30px' }}>
          Made with ❤️ by Costi
        </p>

        <Button onClick={onLoginClick} fullWidth>
          🔐 Autentificare
        </Button>
      </SurfaceCard>
    </ScreenContainer>
  );
}
