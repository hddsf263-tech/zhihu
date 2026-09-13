import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import './styles.css';

const places = [
  { id: 'portfolio', title: '作品村', subtitle: '进入项目路线', className: 'portfolio' },
  { id: 'feedback', title: '投递码头', subtitle: '尽早获得反馈', className: 'feedback' },
  { id: 'skills', title: '技能森林', subtitle: '补齐工具方法', className: 'skills' },
];

function Home() {
  const navigate = useNavigate();
  return <main className="approved-page">
    <div className="approved-map">
      <img className="approved-art" src="/assets/approved-map-ui.png" alt="知乎像素经验地图：作品村、投递码头、技能森林和刘看山向导" />
      <nav className="approved-hotspots" aria-label="经验地图地点">
        {places.map(place => <Link key={place.id} className={`hotspot ${place.className}`} to={`/jobs/job_replay_pm_intern?route=${place.id}`} aria-label={`${place.title}：${place.subtitle}`}><span className="sr-only">{place.title}：{place.subtitle}</span></Link>)}
        <button className="hotspot guide-hotspot" aria-label="小山：路线提示"><span className="sr-only">小山：先走一条你能坚持的路</span></button>
        <button className="hotspot stamp-hotspot" onClick={() => navigate('/maps/map_replay_pm_intern')} aria-label="证据邮票：点击打开知乎原文"><span className="sr-only">证据邮票：点击打开知乎原文</span></button>
      </nav>
    </div>
  </main>;
}

function Job() { return <main className="sub-page"><Link to="/" className="back-link">← 回到地图</Link><div className="sub-panel"><span className="eyebrow">驿站 · 01</span><h1>正在整理你的经验地图</h1><p>小山正在沿着地图寻找可核对的路线。</p><div className="stations"><span className="active">排队中</span><span>查找知乎内容</span><span>整理经验路线</span><span>检查来源</span></div><Link className="wood-button" to="/maps/map_replay_pm_intern">进入演示地图</Link></div></main>; }
function Map() { return <main className="sub-page"><Link to="/" className="back-link">← 回到地图</Link><div className="sub-panel"><span className="eyebrow">路线大厅</span><h1>大学生如何准备第一份产品经理实习？</h1><p>小山已经找到 3 个可以探索的地点。选择一条路线开始。</p><div className="route-list">{places.map(p => <Link key={p.id} to={`/maps/map_replay_pm_intern/plan?routeId=route_${p.id}`}><strong>{p.title}</strong><span>{p.subtitle}</span><b>进入 →</b></Link>)}</div></div></main>; }
function Plan() { return <main className="sub-page"><Link to="/maps/map_replay_pm_intern" className="back-link">← 回到路线大厅</Link><div className="sub-panel"><span className="eyebrow">行动背包</span><h1>先做一个可展示项目</h1><p>建议安排：第 1–2 周。完成后回来点亮下一站。</p><label className="task-row"><input type="checkbox" /> <span><strong>选择一个两周内能完成的用户问题</strong><small>完成判据：写出目标用户、问题和验证方式</small></span></label><button className="wood-button">导出行动手册</button></div></main>; }
function App() { return <Routes><Route path="/" element={<Home />} /><Route path="/jobs/:jobId" element={<Job />} /><Route path="/maps/:mapId" element={<Map />} /><Route path="/maps/:mapId/plan" element={<Plan />} /></Routes>; }
createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>);
