import { useState } from 'react';
import FixToText from './FixToText';
import ScreenContainer from './ScreenContainer';
import Separator from './Separator';
import SurfaceCard from './SurfaceCard';

function NavRow({ label, active, onClick, danger = false, withSeparator = false }) {
  return (
    <>
      <div
        onClick={onClick}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 18px',
          cursor: 'pointer',
          fontSize: '15px',
          fontWeight: active ? 600 : 400,
          borderRadius: '12px',
          background: active ? '#E5F0FF' : 'transparent',
          color: danger ? '#FF3B30' : active ? '#0A84FF' : '#111827',
          transition: 'background 0.15s ease',
        }}
      >
        <FixToText text={label} maxWidth='85%' fontSize='15px' weight={active ? 600 : 400} />
        {!danger && <span style={{ fontSize: '18px', color: '#C7C7CC' }}>›</span>}
      </div>
      {withSeparator && <Separator margin='0' color='#eee' />}
    </>
  );
}

export default function Sidebar({ setPage, isAdmin, logout, theme, setTheme, user }) {
  const [active, setActive] = useState(null);

  const navItems = [
    { key: 'venit', label: 'Venit' },
    { key: 'status-venit', label: 'Status Venit' },
    { key: 'cheltuieli', label: 'Cheltuieli' },
    { key: 'grafice', label: 'Grafic cheltuieli' },
    { key: 'economii', label: 'Economii / Vacanță' },
    { key: 'diagrama', label: 'Diagramă luna în curs' },
    { key: 'fonduri', label: 'Fonduri investiții' },
    { key: 'grafice-fonduri', label: 'Grafice Fonduri' },
    isAdmin ? { key: 'admin', label: 'Admin' } : { key: 'profil', label: 'Profil utilizator' },
  ];

  const handleClick = (key) => {
    setActive(key);
    setPage(key);
  };

  return (
    <ScreenContainer>
      <div style={{ maxWidth: '600px', margin: '20px auto' }}>
        <SurfaceCard
          style={{
            background: 'linear-gradient(135deg, #0A84FF, #5E5CE6)',
            color: 'white',
            borderRadius: '24px',
            marginBottom: '25px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          }}
        >
          <div style={{ fontSize: '14px', opacity: 0.9 }}>
            Bine ai venit, <strong>{user?.username}</strong>
          </div>
          <div style={{ fontSize: '48px', opacity: 0.95, marginTop: '12px' }}>💰</div>
          <div style={{ fontSize: '16px', fontWeight: 500, marginTop: '12px' }}>Budget App</div>
        </SurfaceCard>

        <SurfaceCard style={{ marginBottom: '20px' }}>
          {navItems.map((item, index) => (
            <NavRow
              key={item.key}
              label={item.label}
              active={active === item.key}
              onClick={() => handleClick(item.key)}
              withSeparator={index < navItems.length - 1}
            />
          ))}
        </SurfaceCard>

        <SurfaceCard>
          <NavRow
            label={theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            withSeparator
          />
          <NavRow label='Logout' onClick={logout} danger />
        </SurfaceCard>
      </div>
    </ScreenContainer>
  );
}
