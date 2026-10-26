"use client";

export default function Home() {
  return (
    <div style={{fontFamily:'sans-serif', background:'#fff', minHeight:'100vh'}}>
      <header style={{padding:'15px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#ff6a00', color:'white'}}>
        <h1 style={{margin:0, fontWeight:'bold', fontSize:'20px'}}>PRAYAS POINT</h1>
        <a href="/admin" style={{background:'white', color:'#ff6a00', padding:'8px 15px', borderRadius:'20px', textDecoration:'none', fontWeight:'bold'}}>Admin Login</a>
      </header>

      <div style={{textAlign:'center', padding:'60px 20px'}}>
        <h1 style={{fontSize:'48px', color:'#ff6a00', margin:0}}>PRAYAS POINT</h1>
        <h2 style={{letterSpacing:'5px'}}>LUCKNOW</h2>
        <p style={{marginTop:'20px', fontSize:'18px'}}>Uttar Pradesh ka No.1 Learning Platform</p>
        
        <div style={{marginTop:'30px', display:'flex', gap:'15px', justifyContent:'center'}}>
          <a href="/admin" style={{background:'#ff6a00', color:'white', padding:'12px 25px', borderRadius:'8px', textDecoration:'none'}}>Student Login</a>
          <a href="/admin" style={{border:'2px solid #ff6a00', color:'#ff6a00', padding:'12px 25px', borderRadius:'8px', textDecoration:'none'}}>Go to Dashboard</a>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(250px, 1fr))', gap:'20px', padding:'20px'}}>
        <div style={{border:'1px solid #eee', padding:'20px', borderRadius:'10px', textAlign:'center'}}><h3>📚 Courses</h3><p>All Competitive Exams</p></div>
        <div style={{border:'1px solid #eee', padding:'20px', borderRadius:'10px', textAlign:'center'}}><h3>📝 Test Series</h3><p>Daily Mock Tests</p></div>
        <div style={{border:'1px solid #eee', padding:'20px', borderRadius:'10px', textAlign:'center'}}><h3>📄 Notes</h3><p>PDF & Video Lectures</p></div>
      </div>
    </div>
  );
}