import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import { useAuth } from "../context/AuthContext";

const Login = () => {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  // Reset modal
  const [resetModal,    setResetModal]    = useState(false);
  const [resetEmail,    setResetEmail]    = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetPin,      setResetPin]      = useState('');
  const [resetTarjeta,  setResetTarjeta]  = useState('');
  const [resetError,    setResetError]    = useState('');
  const [resetLoading,  setResetLoading]  = useState(false);
  const [resetOk,       setResetOk]       = useState(false);

  const { login } = useAuth();
  const navigate  = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const user = await login(email, password);
      if      (user.role === 'admin_tecnico') navigate('/tecnico');
      else if (user.role === 'admin')         navigate('/admin');
      else if (user.role === 'supervisor')    navigate('/supervisor');
      else if (user.role === 'contador')      navigate('/contador');
      else if (user.role === 'auditor')       navigate('/auditor');
      else if (user.role === 'bodeguero')     navigate('/cajero/ventas');
      else                                    navigate('/cajero');
    } catch (err) {
      setError(err.message || "Credenciales inválidas");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setResetError('');
    if (!resetEmail || !resetPassword || !resetPin || !resetTarjeta) {
      setResetError('Todos los campos son requeridos (PIN + tarjeta)');
      return;
    }
    setResetLoading(true);
    try {
      const res = await fetch('/api/auth-admin/reset-seguro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username:       resetEmail,
          password:       resetPassword,
          pin:            resetPin,
          codigo_tarjeta: resetTarjeta.toUpperCase(),
        })
      });
      const data = await res.json();
      if (!res.ok) { setResetError(data.message || 'Error'); return; }
      setResetOk(true);
      setTimeout(() => { setResetModal(false); setResetOk(false); }, 2000);
    } catch {
      setResetError('Error de conexión');
    } finally {
      setResetLoading(false);
    }
  };

  const inp = {
    width:"100%", background:"#0f172a", border:"1.5px solid #1e293b",
    borderRadius:10, padding:"12px 14px", color:"white", fontSize:14,
    outline:"none", boxSizing:"border-box",
  };
  const inpDark = { ...inp, border:'1.5px solid #334155', marginBottom:10 };

  const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
      {showPass
        ? <><path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7 7 0 0 0-2.79.588l.77.771A6 6 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8q-.086.13-.195.288c-.335.48-.83 1.12-1.465 1.755q-.247.248-.517.486z"/><path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829"/><path d="M3.35 5.47q-.27.24-.518.487A13 13 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7 7 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12z"/></>
        : <><path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8M1.173 8a13 13 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5s3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8q-.086.13-.195.288c-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5s-3.879-1.168-5.168-2.457A13 13 0 0 1 1.172 8z"/><path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0"/></>
      }
    </svg>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#020617", display:"flex", position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", inset:0, pointerEvents:"none",
        backgroundImage:"radial-gradient(rgba(255,255,255,0.07) 1.5px, transparent 1.5px)",
        backgroundSize:"26px 26px" }} />

      {/* Left panel */}
      <div style={{ width:"50%", padding:"60px 50px", display:"flex", flexDirection:"column",
        justifyContent:"space-between", position:"relative", zIndex:1 }}>
        <div>
          <p style={{ color:"white", fontWeight:700, fontSize:16, marginBottom:48 }}>SmartMerca</p>
          <h1 style={{ color:"white", fontWeight:800, fontSize:"2.6rem", lineHeight:1.2, marginBottom:16 }}>
            Gestiona tu tienda<br />
            <span style={{ color:"#3b82f6" }}>inteligentemente</span>
          </h1>
          <p style={{ color:"#64748b", fontSize:15, marginBottom:40 }}>
            Sistema completo para administrar inventario, ventas y usuarios.
          </p>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {[["📦","Control de inventario en tiempo real"],["🔍","Escaneo de códigos de barras"],
              ["📊","Reportes detallados de ventas"],["📅","Control automático de vencimientos"]].map(([icon,text]) => (
              <div key={text} style={{ display:"flex", alignItems:"center", gap:14 }}>
                <div style={{ width:36, height:36, background:"#1e293b", borderRadius:10,
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>{icon}</div>
                <span style={{ color:"#cbd5e1", fontSize:14 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ borderTop:"1px solid #1e293b", paddingTop:24 }}>
          <div style={{ display:"flex", justifyContent:"space-around", textAlign:"center" }}>
            {[["360°","Control"],["7","Roles"],["24/7","Activo"]].map(([v,l]) => (
              <div key={l}>
                <div style={{ color:"#3b82f6", fontWeight:800, fontSize:"1.5rem" }}>{v}</div>
                <div style={{ color:"#475569", fontSize:11, textTransform:"uppercase", letterSpacing:"0.06em", marginTop:2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center",
        padding:"40px 60px", position:"relative", zIndex:1 }}>
        <div style={{ width:"100%", maxWidth:400 }}>
          <div style={{ textAlign:"center", marginBottom:32 }}>
            <h2 style={{ color:"white", fontWeight:700, fontSize:"1.8rem", marginBottom:6 }}>Iniciar sesión</h2>
            <p style={{ color:"#64748b", fontSize:14, margin:0 }}>Accede al sistema</p>
          </div>

          {error && (
            <div style={{ background:"#450a0a", border:"1px solid #dc2626", borderRadius:8,
              padding:"10px 14px", color:"#fca5a5", marginBottom:16, fontSize:13 }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom:16 }}>
              <label style={{ color:"#94a3b8", fontSize:12, fontWeight:600, display:"block",
                marginBottom:6, textTransform:"uppercase", letterSpacing:"0.05em" }}>
                Correo electrónico
              </label>
              <input type="email" placeholder="correo@ejemplo.com" value={email}
                onChange={e => setEmail(e.target.value)} required autoComplete="email" style={inp} />
            </div>
            <div style={{ marginBottom:8 }}>
              <label style={{ color:"#94a3b8", fontSize:12, fontWeight:600, display:"block",
                marginBottom:6, textTransform:"uppercase", letterSpacing:"0.05em" }}>
                Contraseña
              </label>
              <div style={{ position:"relative" }}>
                <input type={showPass?"text":"password"} placeholder="••••••••" value={password}
                  onChange={e => setPassword(e.target.value)} required autoComplete="current-password"
                  style={{ ...inp, paddingRight:44 }} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)",
                    background:"none", border:"none", color:"#64748b", cursor:"pointer",
                    padding:4, display:"flex", alignItems:"center" }}>
                  <EyeIcon />
                </button>
              </div>
            </div>
            <div style={{ textAlign:"right", marginBottom:24 }}>
              <button type="button" onClick={() => setResetModal(true)}
                style={{ background:"none", border:"none", color:"#3b82f6",
                  fontSize:13, fontWeight:600, cursor:"pointer" }}>
                ¿Olvidaste tu contraseña?
              </button>
            </div>
            <button type="submit" disabled={loading}
              style={{ width:"100%", background:"#2563eb", border:"none", borderRadius:10,
                padding:"14px", color:"white", fontWeight:700, fontSize:15, cursor:"pointer" }}>
              {loading ? "Verificando..." : "Ingresar al sistema"}
            </button>
          </form>
        </div>
      </div>

      {/* Modal reset con doble factor */}
      {resetModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }}>
          <div style={{ width:360, background:'#020617', border:'1px solid #1e293b',
            borderRadius:14, padding:24, boxShadow:'0 20px 60px rgba(0,0,0,0.6)' }}>

            <div style={{ textAlign:'center', marginBottom:20 }}>
              <div style={{ fontSize:32, marginBottom:6 }}>🔐</div>
              <h5 style={{ color:'white', fontWeight:700, margin:0 }}>Recuperar contraseña</h5>
              <p style={{ color:'#64748b', fontSize:12, marginTop:4 }}>
                ⚠️ Requiere PIN <strong>y</strong> código de tarjeta del administrador
              </p>
            </div>

            {resetOk ? (
              <div style={{ textAlign:'center', padding:'20px 0' }}>
                <div style={{ fontSize:40 }}>✅</div>
                <p style={{ color:'#22c55e', fontWeight:700, marginTop:8 }}>Contraseña actualizada</p>
              </div>
            ) : (
              <>
                {resetError && (
                  <div style={{ background:'#450a0a', border:'1px solid #dc2626', borderRadius:8,
                    padding:'8px 12px', color:'#fca5a5', fontSize:13, marginBottom:12 }}>
                    ⚠️ {resetError}
                  </div>
                )}

                <div style={{ background:'#0f172a', border:'1px solid #1e3a5f', borderRadius:8,
                  padding:12, marginBottom:12, fontSize:12, color:'#64748b' }}>
                  <strong style={{ color:'#3b82f6' }}>Seguridad reforzada:</strong> Para restablecer una contraseña
                  se requieren ambos factores del administrador.
                </div>

                <label style={{ color:'#94a3b8', fontSize:11, fontWeight:600, display:'block',
                  marginBottom:4, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                  Usuario (correo o nombre)
                </label>
                <input placeholder="correo@ejemplo.com" value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)} style={inpDark} />

                <label style={{ color:'#94a3b8', fontSize:11, fontWeight:600, display:'block',
                  marginBottom:4, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                  Nueva contraseña
                </label>
                <input type="password" placeholder="Nueva contraseña" value={resetPassword}
                  onChange={e => setResetPassword(e.target.value)} style={inpDark} />

                <div style={{ borderTop:'1px solid #1e293b', margin:'10px 0', paddingTop:10 }}>
                  <p style={{ color:'#94a3b8', fontSize:11, fontWeight:700, marginBottom:8,
                    textTransform:'uppercase', letterSpacing:'0.05em' }}>
                    Autorización del administrador
                  </p>
                </div>

                <label style={{ color:'#94a3b8', fontSize:11, fontWeight:600, display:'block',
                  marginBottom:4, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                  1️⃣ PIN del administrador *
                </label>
                <input type="password" placeholder="PIN (4-6 dígitos)" value={resetPin}
                  onChange={e => setResetPin(e.target.value)} maxLength={6}
                  style={{ ...inpDark, letterSpacing:4, textAlign:'center', fontSize:18 }} />

                <label style={{ color:'#94a3b8', fontSize:11, fontWeight:600, display:'block',
                  marginBottom:4, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                  2️⃣ Código de tarjeta admin *
                </label>
                <input placeholder="ADMIN-XXXXXX (escanear o escribir)" value={resetTarjeta}
                  onChange={e => setResetTarjeta(e.target.value.toUpperCase())}
                  style={{ ...inpDark, fontFamily:'monospace', fontSize:13 }} />

                <div style={{ display:'flex', gap:10, marginTop:4 }}>
                  <button onClick={() => { setResetModal(false); setResetError(''); }}
                    style={{ flex:1, background:'none', border:'1px solid #334155',
                      borderRadius:8, color:'#94a3b8', padding:'10px', cursor:'pointer', fontSize:14 }}>
                    Cancelar
                  </button>
                  <button onClick={handleReset} disabled={resetLoading}
                    style={{ flex:2, background:'#2563eb', border:'none', borderRadius:8,
                      color:'white', padding:'10px', cursor:'pointer', fontSize:14, fontWeight:700 }}>
                    {resetLoading ? '⏳ Verificando...' : '🔐 Restablecer'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;