import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import './styles.css';

const places = [
  { id: 'portfolio', title: '作品村', subtitle: '先做可展示作品', tone: 'brick', x: '15%', y: '66%' },
  { id: 'feedback', title: '投递码头', subtitle: '尽早获得反馈', tone: 'forest', x: '70%', y: '43%' },
  { id: 'skills', title: '技能森林', subtitle: '补齐工具方法', tone: 'gold', x: '72%', y: '74%' },
];

function Guide() {
  const [wave, setWave] = useState(false);
  return <button className="guide" onMouseEnter={() => setWave(true)} onMouseLeave={() => setWave(false)} onFocus={() => setWave(true)} onBlur={() => setWave(false)} aria-label="小山向导：查看提示">
    <img src={`/assets/${wave ? 'xiaoshan-wave' : 'xiaoshan-idle'}.gif`} alt="小山向导" />
    <span className="speech"><strong>小山</strong><br />先走一条你能坚持的路</span>
  </button>;
}

function Signpost({ place }: { place: typeof places[number] }) {
  return <Link to={`/jobs/job_replay_pm_intern?route=${place.id}`} className={`signpost ${place.tone}`} style={{ left: place.x, top: place.y }}>
    <span className="sign-title">{place.title}</span><span className="sign-subtitle">{place.subtitle}</span>
  </Link>;
}

function Home() {
  const navigate = useNavigate();
  return <main className="world-page">
    <header className="world-header"><div><span className="eyebrow">知乎经验地图 · PIXEL WORLD</span><h1>把建议，走成一条路</h1><p>从一个真实问题出发，在地图上找到适合自己的经验路线。</p></div><div className="header-actions"><span className="status-pill"><i /> 演示案例 · 已整理</span><button className="text-button" onClick={() => navigate('/maps/map_replay_pm_intern')}>打开地图</button></div></header>
    <section className="map-shell" aria-label="知乎经验地图首页">
      <div className="sky-layer" /><div className="hill-layer" /><div className="river-layer" />
      <div className="tree tree-a" /><div className="tree tree-b" /><div className="tree tree-c" /><div className="tree tree-d" /><div className="tree tree-e" />
      <div className="road road-main" /><div className="road road-north" /><div className="road road-south" />
      <article className="quest-note"><span className="note-kicker">出发便签 · 01</span><h2>如何准备第一份产品经理实习？</h2><p>零实习 · 8 周 · 每周 10 小时 · 预算 500 元</p><span className="demo-tag">演示案例</span></article>
      <div className="map-stone"><span className="stone-cap" /><strong>经验石碑</strong><small>选择一条路线</small></div>
      {places.map((place) => <Signpost key={place.id} place={place} />)}
      <Guide />
      <button className="evidence-stamp" onClick={() => navigate('/maps/map_replay_pm_intern')}><strong>证据邮票 #02</strong><span>核对来源原话</span><small>点击打开知乎原文</small></button>
      <button className="backpack" onClick={() => navigate('/maps/map_replay_pm_intern/plan?routeId=route_portfolio')}>🎒 装进行动手册 <span>→</span></button>
      <div className="map-compass" aria-hidden="true">N</div>
    </section>
    <section className="world-footer"><div><strong>地图状态</strong><span>3 个地点 · 2 个阶段 · 1 枚待核对证据</span></div><div><strong>探索提示</strong><span>Hover 地点查看说明，点击建筑进入路线</span></div></section>
  </main>;
}
function Job() { return <main className="sub-page"><Link to="/" className="back-link">← 回到地图</Link><div className="sub-panel"><span className="eyebrow">驿站 · 01</span><h1>正在整理你的经验地图</h1><p>小山正在沿着地图寻找可核对的路线。</p><div className="stations"><span className="active">排队中</span><span>查找知乎内容</span><span>整理经验路线</span><span>检查来源</span></div><Link className="wood-button" to="/maps/map_replay_pm_intern">进入演示地图</Link></div></main>; }
function Map() { return <main className="sub-page"><Link to="/" className="back-link">← 回到地图</Link><div className="sub-panel"><span className="eyebrow">路线大厅</span><h1>大学生如何准备第一份产品经理实习？</h1><p>小山已经找到 3 个可以探索的地点。选择一条路线开始。</p><div className="route-list">{places.map(p => <Link key={p.id} to={`/maps/map_replay_pm_intern/plan?routeId=route_${p.id}`}><strong>{p.title}</strong><span>{p.subtitle}</span><b>进入 →</b></Link>)}</div></div></main>; }
function Plan() { return <main className="sub-page"><Link to="/maps/map_replay_pm_intern" className="back-link">← 回到路线大厅</Link><div className="sub-panel"><span className="eyebrow">行动背包</span><h1>先做一个可展示项目</h1><p>建议安排：第 1–2 周。完成后回来点亮下一站。</p><label className="task-row"><input type="checkbox" /> <span><strong>选择一个两周内能完成的用户问题</strong><small>完成判据：写出目标用户、问题和验证方式</small></span></label><button className="wood-button">导出行动手册</button></div></main>; }
function App() { return <Routes><Route path="/" element={<Home />} /><Route path="/jobs/:jobId" element={<Job />} /><Route path="/maps/:mapId" element={<Map />} /><Route path="/maps/:mapId/plan" element={<Plan />} /></Routes>; }
createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>);
