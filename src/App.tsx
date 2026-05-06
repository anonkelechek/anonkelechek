import React, { useState, useEffect } from 'react';
import {
  Search,
  Home,
  MessageCircle,
  Settings,
  Trash2,
  Save,
  XCircle,
  UserX
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy,
  serverTimestamp,
  deleteDoc,
  doc,
  getDocs,
  where,
  setDoc
} from 'firebase/firestore';
import { db } from './firebase';
import './App.css';

const generateIdentity = () => 'Аноним-' + Math.random().toString(16).substr(2, 4).toUpperCase();

const QUIZ_QUESTIONS = [
  {
    question: "Каких из этих классов ЕСТЬ в КМИТ?",
    options: ["11е", "8е", "3ж", "6г"],
    correctIndex: 3
  },
  {
    question: "Кого из этих учителей НЕТУ в составе школы?",
    options: ["Анара Жусуевна", "Айбибигуль Ахметовна", "Эрнист Табылдиевич", "Алия Алымбековна"],
    correctIndex: 1
  },
  {
    question: "Кого НЕТУ в школе из этих завучей?",
    options: ["Алмаз Кыдырбаев", "Гульназ Хамиовна", "Ибрагим Алыбеков", "Ахмет Маманов"],
    correctIndex: 2
  }
];

// Компонент Логотипа для переиспользования
// Компонент Логотипа больше не нужен как отдельный тег, так как он в фоне


function App() {
  const [quizStatus, setQuizStatus] = useState<'pending' | 'passed' | 'failed'>('pending');
  const [showWelcome, setShowWelcome] = useState(true);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);

  const [roleStatus, setRoleStatus] = useState<'pending' | 'admin_login' | 'student_login' | 'done'>('pending');
  const [role, setRole] = useState<'admin' | 'student'>('student');
  
  const [adminPassword, setAdminPassword] = useState('');
  const [studentRealName, setStudentRealName] = useState('');
  const [studentNickname, setStudentNickname] = useState('');
  const [studentClass, setStudentClass] = useState('');

  const [activeTab, setActiveTab] = useState('home');
  const [activeView, setActiveView] = useState<'feed' | 'settings'>('feed');
  const [postText, setPostText] = useState('');
  const [posts, setPosts] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  
  const [identity, setIdentity] = useState('');
  const [tempIdentity, setTempIdentity] = useState('');
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    const savedQuiz = localStorage.getItem('void_quiz_status');
    if (savedQuiz === 'passed') {
      setQuizStatus('passed');
    } else if (savedQuiz === 'failed') {
      setQuizStatus('failed');
    } else {
      setQuizStatus('pending');
    }
  }, []);

  useEffect(() => {
    if (quizStatus !== 'passed') return;
    
    const savedRoleStatus = localStorage.getItem('void_role_status');
    const savedRole = localStorage.getItem('void_role');
    
    if (savedRoleStatus === 'done' && (savedRole === 'admin' || savedRole === 'student')) {
      setRoleStatus('done');
      setRole(savedRole as 'admin' | 'student');
    } else {
      setRoleStatus('pending');
    }
  }, [quizStatus]);

  useEffect(() => {
    if (quizStatus !== 'passed') return;
    try {
      let savedIdentity = localStorage.getItem('void_identity');
      if (!savedIdentity) {
        savedIdentity = generateIdentity();
        localStorage.setItem('void_identity', savedIdentity);
      }
      setIdentity(savedIdentity);
      setTempIdentity(savedIdentity);
    } catch (e) {
      setIdentity(generateIdentity());
    }
  }, [quizStatus]);

  useEffect(() => {
    if (quizStatus !== 'passed' || roleStatus !== 'done' || !identity || role === 'admin') return;
    
    // Следим за тем, не удалил ли нас админ
    try {
      const unsubscribe = onSnapshot(doc(db, 'users', identity), (snapshot) => {
        if (!snapshot.exists()) {
          // НАС УДАЛИЛИ! Бан.
          localStorage.clear();
          localStorage.setItem('void_quiz_status', 'failed');
          setQuizStatus('failed');
          setRoleStatus('pending');
          alert("Ваш доступ был аннулирован администрацией. Устройство заблокировано.");
        }
      });
      return () => unsubscribe();
    } catch (e) {
      console.error("Ошибка слежения за статусом пользователя", e);
    }
  }, [quizStatus, roleStatus, identity, role]);

  useEffect(() => {
    if (quizStatus !== 'passed' || roleStatus !== 'done') return;
    try {
      const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedPosts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Уведомления о новых постах (если это не первоначальная загрузка)
        if (!isInitialLoad) {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const newPost: any = change.doc.data();
              // Не уведомлять о своих же постах
              if (newPost.author !== identity && Notification.permission === 'granted') {
                new Notification("КЕЛЕЧЕК АНОН: Новый слив!", {
                  body: renderContent(newPost.content),
                  icon: '/logo.png'
                });
              }
            }
          });
        }
        
        setPosts(fetchedPosts);
        setIsInitialLoad(false);
      });
      return () => unsubscribe();
    } catch (e) {
      console.error(e);
    }
  }, [quizStatus, roleStatus, isInitialLoad, identity]);

  useEffect(() => {
    if (quizStatus !== 'passed' || roleStatus !== 'done' || role !== 'admin') return;
    try {
      const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
        const fetchedUsers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setAdminUsers(fetchedUsers);
      });
      return () => unsubscribe();
    } catch (e) {
      console.error(e);
    }
  }, [quizStatus, roleStatus, role]);

  const handleQuizAnswer = (selectedIndex: number) => {
    const currentQuestion = QUIZ_QUESTIONS[currentQuizIndex];
    if (selectedIndex === currentQuestion.correctIndex) {
      if (currentQuizIndex < QUIZ_QUESTIONS.length - 1) {
        setCurrentQuizIndex(currentQuizIndex + 1);
      } else {
        localStorage.setItem('void_quiz_status', 'passed');
        setQuizStatus('passed');
      }
    } else {
      localStorage.setItem('void_quiz_status', 'failed');
      setQuizStatus('failed');
    }
  };

  const handleAdminLogin = () => {
    if (adminPassword === 'bolotbek') {
      localStorage.setItem('void_role_status', 'done');
      localStorage.setItem('void_role', 'admin');
      setRole('admin');
      setRoleStatus('done');
      if (Notification.permission !== 'denied') Notification.requestPermission();
    } else {
      alert("Неверный пароль.");
    }
  };

  const handleStudentLogin = async () => {
    if (!studentRealName.trim() || !studentNickname.trim() || !studentClass.trim()) {
      alert("Заполните все поля");
      return;
    }
    
    try {
      await setDoc(doc(db, 'users', studentNickname), {
        fullName: studentRealName,
        schoolClass: studentClass,
        identityCode: studentNickname,
        createdAt: serverTimestamp()
      });
      
      localStorage.setItem('void_identity', studentNickname);
      setIdentity(studentNickname);
      setTempIdentity(studentNickname);
      
      localStorage.setItem('void_role_status', 'done');
      localStorage.setItem('void_role', 'student');
      setRole('student');
      setRoleStatus('done');
      if (Notification.permission !== 'denied') Notification.requestPermission();
    } catch (e) {
      console.error("Ошибка сохранения данных ученика", e);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm("Удалить этот пост?")) return;
    try {
      await deleteDoc(doc(db, 'posts', postId));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Вы собираетесь СТЕРЕТЬ пользователя и все его посты. Продолжить?")) return;
    try {
      const q = query(collection(db, 'posts'), where('author', '==', userId));
      const snap = await getDocs(q);
      const deletePromises = snap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);
      await deleteDoc(doc(db, 'users', userId));
    } catch (e) {
      console.error(e);
    }
  };

  const handlePostSubmit = async (e: React.KeyboardEvent<HTMLInputElement> | React.MouseEvent<HTMLButtonElement>) => {
    if ('key' in e && e.key !== 'Enter') return;
    if (!postText.trim()) return;

    const currentText = postText;
    setPostText(''); 

    try {
      await addDoc(collection(db, 'posts'), {
        author: identity,
        content: currentText,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Ошибка при публикации:", error);
    }
  };

  const handleSaveNickname = () => {
    if (!tempIdentity.trim()) return;
    localStorage.setItem('void_identity', tempIdentity);
    setIdentity(tempIdentity);
    alert('Никнейм успешно изменен на: ' + tempIdentity);
  };

  const handleResetIdentity = () => {
    const newIdentity = generateIdentity();
    localStorage.setItem('void_identity', newIdentity);
    setIdentity(newIdentity);
    setTempIdentity(newIdentity);
    alert('Личность сброшена. Ваш новый ID: ' + newIdentity);
  };

  const getInitials = (name: any) => {
    if (typeof name === 'string' && name.length > 0) return name.substring(0, 2).toUpperCase();
    return '?';
  };

  const renderContent = (content: any) => {
    if (typeof content === 'object') return JSON.stringify(content);
    return String(content || '');
  };

  if (quizStatus === 'failed') {
    return (
      <div style={{ height: '100vh', width: '100vw', backgroundColor: '#000', backgroundImage: 'linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.8)), url("./logo.png")', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ff4444', fontFamily: 'monospace' }}>
        <h1 style={{ letterSpacing: '4px', textTransform: 'uppercase', marginBottom: '16px' }}>Доступ запрещен</h1>
        <p style={{ letterSpacing: '1px' }}>Вы не из нашей школы. Ваше устройство заблокировано.</p>
      </div>
    );
  }

  if (showWelcome) {
    return (
      <div 
        onClick={() => setShowWelcome(false)}
        onKeyDown={() => setShowWelcome(false)}
        tabIndex={0}
        style={{ 
          height: '100vh', 
          width: '100vw', 
          backgroundColor: '#000', 
          backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7)), url("./logo.png")', 
          backgroundSize: 'cover', 
          backgroundPosition: 'center', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          color: '#fff', 
          cursor: 'pointer',
          outline: 'none'
        }}
      >
        <img src="./logo.png" style={{ width: '250px', marginBottom: '40px', filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.2))' }} alt="Logo" />
        <h1 style={{ letterSpacing: '8px', fontSize: '1.2rem', marginBottom: '20px', fontWeight: 300, textAlign: 'center' }}>КЕЛЕЧЕК АНОН</h1>
        <div style={{ 
          fontFamily: 'monospace', 
          animation: 'pulse 2s infinite', 
          letterSpacing: '2px', 
          fontSize: '0.8rem',
          color: 'rgba(255,255,255,0.6)'
        }}>
          ДОБРО ПОЖАЛОВАТЬ. НАЖМИТЕ ЛЮБУЮ КЛАВИШУ.
        </div>
        <style>{`
          @keyframes pulse {
            0% { opacity: 0.3; }
            50% { opacity: 1; }
            100% { opacity: 0.3; }
          }
        `}</style>
      </div>
    );
  }

  if (quizStatus === 'pending') {
    const currentQ = QUIZ_QUESTIONS[currentQuizIndex];
    return (
      <div style={{ height: '100vh', width: '100vw', backgroundColor: '#000', backgroundImage: 'linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.8)), url("./logo.png")', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexDirection: 'column' }}>
        <div className="card" style={{ maxWidth: '500px', width: '100%', borderRadius: '0', padding: '40px', textAlign: 'center', border: '1px solid var(--border-color)', backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.6)' }}>
          <h2 style={{ letterSpacing: '2px', marginBottom: '8px' }}>ПРОВЕРКА ЛИЧНОСТИ</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '0.9rem' }}>Вопрос {currentQuizIndex + 1} из {QUIZ_QUESTIONS.length}</p>
          <h3 style={{ marginBottom: '32px', fontWeight: 400, lineHeight: 1.5 }}>{currentQ.question}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {currentQ.options.map((option, idx) => (
              <button key={idx} className="btn btn-secondary" style={{ borderRadius: '0', width: '100%', padding: '16px', textAlign: 'left', display: 'block', textTransform: 'none', letterSpacing: '1px' }} onClick={() => handleQuizAnswer(idx)}>
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (roleStatus === 'pending') {
    return (
      <div style={{ height: '100vh', width: '100vw', backgroundColor: '#000', backgroundImage: 'linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.8)), url("./logo.png")', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexDirection: 'column' }}>
        <div className="card" style={{ maxWidth: '500px', width: '100%', borderRadius: '0', padding: '40px', textAlign: 'center', border: '1px solid var(--border-color)', backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.6)' }}>
          <h2 style={{ letterSpacing: '2px', marginBottom: '32px' }}>РЕЖИМ ДОСТУПА</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <button className="btn btn-secondary" style={{ borderRadius: '0', width: '100%', padding: '16px', letterSpacing: '1px' }} onClick={() => setRoleStatus('student_login')}>
              ВОЙТИ КАК УЧЕНИК
            </button>
            <button className="btn btn-secondary" style={{ borderRadius: '0', width: '100%', padding: '16px', color: 'var(--text-secondary)' }} onClick={() => setRoleStatus('admin_login')}>
              АДМИНИСТРАТОР
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (roleStatus === 'admin_login') {
    return (
      <div style={{ height: '100vh', width: '100vw', backgroundColor: '#000', backgroundImage: 'linear-gradient(rgba(0,0,0,0.9), rgba(0,0,0,0.9)), url("/logo.png")', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexDirection: 'column' }}>
        <div className="card" style={{ maxWidth: '400px', width: '100%', borderRadius: '0', padding: '40px', textAlign: 'center', border: '1px solid var(--border-color)', backdropFilter: 'blur(5px)', background: 'rgba(0,0,0,0.7)' }}>
          <h2 style={{ letterSpacing: '2px', marginBottom: '24px', color: '#ff4444' }}>АДМИН ПАНЕЛЬ</h2>
          <input 
            type="password" 
            placeholder="Пароль" 
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid var(--border-color)', color: 'white', borderRadius: '0', marginBottom: '16px', textAlign: 'center', letterSpacing: '4px' }}
          />
          <button className="btn btn-primary" onClick={handleAdminLogin} style={{ borderRadius: '0', width: '100%' }}>ПОДТВЕРДИТЬ</button>
          <button className="btn btn-secondary" onClick={() => setRoleStatus('pending')} style={{ borderRadius: '0', width: '100%', marginTop: '16px', border: 'none' }}>Назад</button>
        </div>
      </div>
    );
  }

  if (roleStatus === 'student_login') {
    return (
      <div style={{ height: '100vh', width: '100vw', backgroundColor: '#000', backgroundImage: 'linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.8)), url("./logo.png")', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexDirection: 'column' }}>
        <div className="card" style={{ maxWidth: '400px', width: '100%', borderRadius: '0', padding: '40px', textAlign: 'center', border: '1px solid var(--border-color)', backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.6)' }}>
          <h2 style={{ letterSpacing: '2px', marginBottom: '8px' }}>ВХОД В ПОДПОЛЬЕ</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.85rem', lineHeight: 1.5 }}>
            Введите ваши настоящие данные для идентификации. <br/>
            <span style={{color: '#ff4444', fontWeight: 600}}>Эту информацию видите только вы. В постах будет отображаться только ваш Никнейм.</span>
          </p>
          
          <input 
            type="text" 
            placeholder="Ваше настоящее ФИО" 
            value={studentRealName}
            onChange={(e) => setStudentRealName(e.target.value)}
            style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid var(--border-color)', color: 'white', borderRadius: '0', marginBottom: '12px' }}
          />
          <input 
            type="text" 
            placeholder="Ваш Никнейм (псевдоним для постов)" 
            value={studentNickname}
            onChange={(e) => setStudentNickname(e.target.value)}
            style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid var(--border-color)', color: 'white', borderRadius: '0', marginBottom: '12px' }}
          />
          <input 
            type="text" 
            placeholder="Ваш Класс (например, 11А)" 
            value={studentClass}
            onChange={(e) => setStudentClass(e.target.value)}
            style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid var(--border-color)', color: 'white', borderRadius: '0', marginBottom: '24px' }}
          />

          <button className="btn btn-primary" onClick={handleStudentLogin} style={{ borderRadius: '0', width: '100%' }}>ПРИСОЕДИНИТЬСЯ</button>
          <button className="btn btn-secondary" onClick={() => setRoleStatus('pending')} style={{ borderRadius: '0', width: '100%', marginTop: '16px', border: 'none' }}>Назад</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container" style={{ backgroundColor: '#000', backgroundImage: 'linear-gradient(rgba(0,0,0,0.9), rgba(0,0,0,0.9)), url("./logo.png")', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', minHeight: '100vh' }}>
      {/* Navbar */}
      <nav className="navbar" style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
        <div className="nav-left" style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
          <div className="search-bar" style={{ borderRadius: '0', border: '1px solid var(--border-color)', background: 'transparent', maxWidth: '300px', width: '100%', margin: 0 }}>
            <Search size={18} />
            <input type="text" placeholder="Поиск..." />
          </div>
        </div>

        <div className="nav-center">
          <div className={`nav-tab ${activeTab === 'home' ? 'active' : ''}`} onClick={() => { setActiveTab('home'); setActiveView('feed'); }} title="Главная">
            <Home size={24} strokeWidth={1.5} />
          </div>
        </div>

        <div className="nav-right">
          <div className="btn-icon" title="Настройки" onClick={() => setActiveView('settings')}><Settings size={18} /></div>
          <div className="btn-icon" title="Сообщения"><MessageCircle size={18} /></div>
          <div className="avatar" style={{ borderRadius: '0', border: '1px solid white', background: 'transparent', color: 'white', fontSize: '10px', width: 'auto', padding: '0 8px' }}>
            {getInitials(identity)}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content" style={{ gridTemplateColumns: '250px 1fr', background: 'transparent' }}>
        {/* Left Sidebar */}
        <aside className="left-sidebar" style={{ background: 'transparent', borderRight: '1px solid var(--border-color)' }}>
          {role === 'admin' ? (
            <>
              <h4 style={{padding: '8px 12px', color: '#ff4444', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '2px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px'}}>База Данных</h4>
              <p style={{padding: '0 12px', fontSize: '0.8rem', color: 'var(--text-secondary)'}}>Все пользователи ({adminUsers.length})</p>
              
              <div style={{display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px'}}>
                {adminUsers.map(user => (
                  <div key={user.id} style={{ border: '1px solid var(--border-color)', padding: '12px', fontSize: '0.85rem' }}>
                    <div style={{ fontWeight: 600, color: 'white', marginBottom: '4px' }}>{user.fullName} <span style={{ color: 'var(--text-secondary)' }}>({user.schoolClass})</span></div>
                    <div style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: '0.75rem' }}>ID: {user.identityCode}</div>
                    <button 
                      className="btn btn-secondary" 
                      style={{ borderRadius: '0', color: '#ff4444', borderColor: '#ff4444', padding: '4px 8px', fontSize: '0.75rem', width: '100%', display: 'flex', justifyContent: 'center', gap: '4px' }}
                      onClick={() => handleDeleteUser(user.id)}
                    >
                      <UserX size={14} /> СТЕРЕТЬ
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="sidebar-item" style={{ borderRadius: '0', cursor: 'pointer' }} onClick={() => setActiveView('settings')}>
                <div className="avatar" style={{ borderRadius: '0', border: '1px solid var(--border-color)', background: 'transparent', color: 'white', fontSize: '10px' }}>ID</div>
                <span style={{ fontWeight: 400 }}>{String(identity)}</span>
              </div>
              
              <div className="divider" style={{margin: '16px 0'}} />
              <h4 style={{padding: '8px 12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '2px'}}>Каналы</h4>
              <div className="sidebar-item" style={{ borderRadius: '0' }} onClick={() => setActiveView('feed')}>
                <div className="avatar" style={{borderRadius: '0', background: 'transparent', color: 'white', border: '1px solid var(--text-secondary)'}}>#</div>
                <span style={{ fontWeight: 400 }}>Общий</span>
              </div>
            </>
          )}
        </aside>

        {/* Content Area */}
        <section className="feed" style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
          
          {activeView === 'settings' ? (
            <div className="feed-container">
              <h2 style={{ marginBottom: '24px', letterSpacing: '2px', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>Настройки профиля</h2>
              
              <div className="card" style={{ borderRadius: '0' }}>
                <h3 style={{ marginBottom: '16px', fontSize: '1.1rem' }}>Изменить никнейм</h3>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                  <input 
                    type="text" 
                    value={tempIdentity}
                    onChange={(e) => setTempIdentity(e.target.value)}
                    style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid var(--border-color)', color: 'white', borderRadius: '0' }}
                  />
                  <button className="btn btn-primary" onClick={handleSaveNickname} style={{ borderRadius: '0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Save size={16} /> Сохранить
                  </button>
                </div>

                <div className="divider" style={{margin: '24px 0'}} />

                <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', color: '#ff4444' }}>Уничтожить личность</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  Генерирует абсолютно новый случайный ID. Все связи с текущим никнеймом будут потеряны локально.
                </p>
                <button className="btn btn-secondary" onClick={handleResetIdentity} style={{ borderRadius: '0', color: '#ff4444', borderColor: '#ff4444', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Trash2 size={16} /> Уничтожить
                </button>
              </div>
            </div>
          ) : (
            <div className="feed-container">
              <div className="card create-post hover-scale" style={{transform: 'none'}}>
                <div className="create-post-top">
                  <div className="avatar" style={{ borderRadius: '0', border: '1px solid var(--border-color)', background: 'transparent', color: 'white', fontSize: '10px' }}>ID</div>
                  <input 
                    type="text" 
                    className="post-input" 
                    style={{ borderRadius: '0', border: '1px solid var(--border-color)', background: 'transparent' }}
                    placeholder="Написать..." 
                    value={postText}
                    onChange={(e) => setPostText(e.target.value)}
                    onKeyDown={handlePostSubmit}
                  />
                </div>
                <div className="divider" />
                <div className="create-post-actions" style={{ justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary" onClick={handlePostSubmit} style={{ borderRadius: '0' }}>
                    Опубликовать
                  </button>
                </div>
              </div>

              {posts.length === 0 ? (
                <div style={{textAlign: 'center', color: 'var(--text-secondary)', padding: '60px', border: '1px dashed var(--border-color)', letterSpacing: '1px'}}>
                  Пустота.
                </div>
              ) : (
                posts.map((post, index) => (
                  <div className="card post" key={post.id || index} style={{ borderRadius: '0', paddingBottom: '16px', position: 'relative' }}>
                    
                    {role === 'admin' && (
                      <button 
                        onClick={() => handleDeletePost(post.id)}
                        style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer' }}
                        title="Удалить пост"
                      >
                        <XCircle size={20} />
                      </button>
                    )}

                    <div className="post-header" style={{ paddingRight: role === 'admin' ? '40px' : '16px' }}>
                      <div className="post-author">
                        <div className="avatar" style={{background: 'transparent', color: 'white', border: '1px solid var(--border-color)', borderRadius: '0', fontSize: '10px'}}>
                          {getInitials(post.author)}
                        </div>
                        <div className="author-info">
                          <span className="author-name" style={{ fontWeight: 500 }}>{renderContent(post.author || 'Аноним')}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="post-content" style={{ overflow: 'hidden' }}>
                      <p style={{ fontWeight: 300, lineHeight: 1.6, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{renderContent(post.content)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      </main>

      {/* Floating Brand Badge */}
      <div style={{ 
        position: 'fixed', 
        bottom: '20px', 
        right: '20px', 
        padding: '10px 20px', 
        background: 'rgba(0,0,0,0.5)', 
        backdropFilter: 'blur(10px)', 
        border: '1px solid var(--border-color)', 
        color: role === 'admin' ? '#ff4444' : '#fff', 
        fontFamily: 'monospace', 
        letterSpacing: '3px', 
        fontSize: '0.75rem', 
        textTransform: 'uppercase',
        zIndex: 1000,
        pointerEvents: 'none',
        opacity: 0.8
      }}>
        {role === 'admin' ? 'KELECHEK:ADMIN_MODE' : 'KELECHEK:ANON_VOID'}
      </div>
    </div>
  );
}

export default App;
