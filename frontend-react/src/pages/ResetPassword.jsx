import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authService } from "../services/authService";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";

const ResetPassword = () => {

const [token,setToken] = useState("");
const [newPass,setNewPass] = useState("");
const [confirm,setConfirm] = useState("");
const [msg,setMsg] = useState("");
const [error,setError] = useState("");
const [loading,setLoading] = useState(false);

const navigate = useNavigate();

const handleSubmit = async(e)=>{
e.preventDefault();

if(newPass !== confirm){
setError("Las contraseñas no coinciden");
return;
}

setError("");
setLoading(true);

try{

const data = await authService.resetPassword(token,newPass);

setMsg(data.message);

setTimeout(()=>{
navigate("/login");
},2000);

}catch(err){

setError(err.message);

}finally{

setLoading(false);

}

};

return(

<>

<style>{`

.full-bg{
background: linear-gradient(160deg,#020617,#0f172a);
min-height:100vh;
position:relative;
overflow:hidden;
color:white;
}

.full-bg::before{
content:'';
position:absolute;
inset:0;
background-image: radial-gradient(rgba(255,255,255,0.08) 1.5px, transparent 1.5px);
background-size:26px 26px;
pointer-events:none;
}

.reset-card{
max-width:420px;
width:100%;
background:#0f172a;
border:1px solid #1f2937;
border-radius:14px;
padding:30px;
}

.input-wrapper{
position:relative;
}

.input-icon{
position:absolute;
left:12px;
top:50%;
transform:translateY(-50%);
color:#6b7280;
}

.form-control{
background:#020617 !important;
border:1px solid #374151 !important;
color:white !important;
}

.form-control:focus{
border-color:#3b82f6 !important;
box-shadow:none;
}

.btn-primary{
background:linear-gradient(135deg,#3b82f6,#1d4ed8);
border:none;
}

`}</style>

<div className="container-fluid full-bg d-flex align-items-center justify-content-center">

<div className="reset-card">

<div className="text-center mb-4">

<h2 className="fw-bold">
 SmartMerca
</h2>

<p className="text-secondary">
Restablecer contraseña
</p>

</div>

{error && (
<div className="alert alert-danger">
{error}
</div>
)}

{msg && (
<div className="alert alert-success">
{msg} — Redirigiendo...
</div>
)}

{!msg && (

<form onSubmit={handleSubmit}>

<div className="mb-3">

<label className="form-label">
Token de recuperación
</label>

<div className="input-wrapper">

<i className="bi bi-key input-icon"></i>

<input
type="text"
className="form-control ps-5"
placeholder="Pega el token aquí"
value={token}
onChange={(e)=>setToken(e.target.value)}
required
/>

</div>

</div>



<div className="mb-3">

<label className="form-label">
Nueva contraseña
</label>

<div className="input-wrapper">

<i className="bi bi-lock input-icon"></i>

<input
type="password"
className="form-control ps-5"
placeholder="Mínimo 6 caracteres"
value={newPass}
onChange={(e)=>setNewPass(e.target.value)}
minLength={6}
required
/>

</div>

</div>



<div className="mb-3">

<label className="form-label">
Confirmar contraseña
</label>

<div className="input-wrapper">

<i className="bi bi-lock-fill input-icon"></i>

<input
type="password"
className="form-control ps-5"
placeholder="Repite la contraseña"
value={confirm}
onChange={(e)=>setConfirm(e.target.value)}
required
/>

</div>

</div>

<button
type="submit"
className="btn btn-primary w-100"
disabled={loading}
>

{loading ? "Guardando..." : "Restablecer contraseña"}

</button>

</form>

)}

<div className="text-center mt-4">

<Link
to="/login"
className="text-decoration-none text-primary"
>

← Volver al inicio

</Link>

</div>

</div>

</div>

</>

);};

export default ResetPassword;