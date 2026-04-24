import React, { useState } from "react";
import { Link } from "react-router-dom";
import { authService } from "../services/authService";
import "bootstrap/dist/css/bootstrap.min.css";

const ForgotPassword = () => {
  const [email,   setEmail]   = useState("");
  const [msg,     setMsg]     = useState("");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await authService.forgotPassword(email);
      setMsg(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:"#020617", display:"flex", alignItems:"center", justifyContent:"center", position:"relative", overflow:"hidden" }}>

     
      <div style={{ position:"absolute", inset:0, pointerEvents:"none", backgroundImage:"radial-gradient(rgba(255,255,255,0.07) 1.5px, transparent 1.5px)", backgroundSize:"26px 26px" }} />

      <div style={{ position:"relative", zIndex:1, width:"100%", maxWidth:420, margin:"0 20px" }}>
        <div style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:14, padding:"36px 32px" }}>

          <div style={{ textAlign:"center", marginBottom:28 }}>
            <h2 style={{ color:"white", fontWeight:700, fontSize:"1.6rem", marginBottom:6 }}> SmartMerca</h2>
            <p style={{ color:"#64748b", fontSize:14, margin:0 }}>Recuperar contraseña</p>
          </div>

          {error && (
            <div style={{ background:"#450a0a", border:"1px solid #dc2626", borderRadius:8, padding:"10px 14px", color:"#fca5a5", marginBottom:16, fontSize:13 }}>
              ⚠️ {error}
            </div>
          )}

          {msg ? (
            <div style={{ background:"#052e16", border:"1px solid #16a34a", borderRadius:10, padding:"20px", textAlign:"center" }}>
              <div style={{ fontSize:40, marginBottom:12 }}></div>
              <p style={{ color:"#86efac", fontWeight:600, fontSize:15, marginBottom:8 }}>
                ¡Correo enviado!
              </p>
              <p style={{ color:"#4ade80", fontSize:13, margin:0 }}>
                Revisa tu bandeja de entrada. Te enviamos las instrucciones para restablecer tu contraseña.
              </p>
              <p style={{ color:"#16a34a", fontSize:12, marginTop:10 }}>
                Si no lo ves, revisa tu carpeta de spam.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom:20 }}>
                <label style={{ color:"#94a3b8", fontSize:12, fontWeight:600, display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.05em" }}>
                  Correo electrónico
                </label>
                <input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{ width:"100%", background:"#020617", border:"1.5px solid #1e293b", borderRadius:10, padding:"12px 14px", color:"white", fontSize:14, outline:"none", boxSizing:"border-box" }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{ width:"100%", background:"#2563eb", border:"none", borderRadius:10, padding:"13px", color:"white", fontWeight:700, fontSize:15, cursor:"pointer" }}
              >
                {loading ? "Enviando..." : " Enviar instrucciones"}
              </button>
            </form>
          )}

          <div style={{ display:"flex", justifyContent:"space-between", marginTop:24, paddingTop:20, borderTop:"1px solid #1e293b" }}>
            <Link to="/login" style={{ color:"#3b82f6", fontSize:13, fontWeight:600, textDecoration:"none" }}>← Volver</Link>
            <Link to="/reset-password" style={{ color:"#3b82f6", fontSize:13, fontWeight:600, textDecoration:"none" }}>Tengo un token →</Link>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;