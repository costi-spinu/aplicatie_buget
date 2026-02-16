import { useState, useEffect } from 'react';
import api from './services/api';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ResetParola from './pages/ResetParola';

import Venit from './pages/Venit';
import Cheltuieli from './pages/Cheltuieli';
import Grafice from './pages/Grafice';
import Economii from './pages/Economii';
import AdminPanel from './pages/AdminPanel';
import DiagramaLunara from './pages/DiagramaLunara';
import Sidebar from './components/Sidebar';
import Fonduri from './pages/Fonduri';
import GraficeFonduri from './pages/GraficeFonduri';
import StatusVenit from './pages/StatusVenit';
import ProfilUtilizator from './pages/ProfilUtilizator';
import NavBar from './components/NavBar';
import ScreenContainer from './components/ScreenContainer';

function App() {
  const [activePage, setActivePage] = useState(null);
  const [showSidebar, setShowSidebar] = useState(true);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authView, setAuthView] = useState('home');

  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  const loggedIn = Boolean(localStorage.getItem('access'));

  useEffect(() => {
    const root = document.documentElement;
    theme === 'dark' ? root.classList.add('dark') : root.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!loggedIn) {
      setUser(null);
      setLoading(false);
      return;
    }

    api
      .get('me/')
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.clear();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [loggedIn]);

  const isAdmin = user?.is_admin === true || user?.is_superuser === true;

  const logout = () => {
    localStorage.clear();
    setUser(null);
    setAuthView('home');
    setActivePage(null);
    setShowSidebar(true);
  };

  const handleOpenPage = (pageKey) => {
    setActivePage(pageKey);
    setShowSidebar(false);
  };

  const handleBack = () => {
    setActivePage(null);
    setShowSidebar(true);
  };

  if (loading) {
    return (
      <ScreenContainer centered>
        <div>⏳ Se încarcă...</div>
      </ScreenContainer>
    );
  }

  if (!user) {
    if (authView === 'home') return <Home onLoginClick={() => setAuthView('login')} />;
    if (authView === 'login') return <Login onLogin={() => setAuthView('home')} onBack={() => setAuthView('home')} />;
    if (authView === 'register') return <Register onBack={() => setAuthView('login')} />;
    if (authView === 'reset') return <ResetParola onBack={() => setAuthView('login')} />;
    return null;
  }

  return (
    <ScreenContainer style={{ padding: 0 }}>
      {showSidebar && (
        <Sidebar
          setPage={handleOpenPage}
          isAdmin={isAdmin}
          logout={logout}
          theme={theme}
          setTheme={setTheme}
          user={user}
        />
      )}

      {!showSidebar && (
        <div style={{ minHeight: '100vh' }}>
          <NavBar onBack={handleBack} />
          <div style={{ padding: '20px' }}>
            {activePage === 'venit' && <Venit />}
            {activePage === 'status-venit' && <StatusVenit />}
            {activePage === 'cheltuieli' && <Cheltuieli />}
            {activePage === 'grafice' && <Grafice />}
            {activePage === 'economii' && <Economii />}
            {activePage === 'diagrama' && <DiagramaLunara />}
            {activePage === 'fonduri' && <Fonduri />}
            {activePage === 'grafice-fonduri' && <GraficeFonduri />}
            {activePage === 'admin' && isAdmin && <AdminPanel />}
            {activePage === 'profil' && !isAdmin && <ProfilUtilizator />}
          </div>
        </div>
      )}
    </ScreenContainer>
  );
}

export default App;
