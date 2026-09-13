import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import './styles.css';

const places = [
  { id: 'portfolio', title: '作品村', subtitle: '进入项目路线', tone: 'brick', x: '36%', y: '63%', icon: '⌂' },
  { id: 'feedback', title: '投递码头', subtitle: '尽早获得反馈', tone: 'forest', x: '76%', y: '32%', icon: '⚑' },
  { id: 'skills', title: '技能森林', subtitle: '补齐工具方法', tone: 'gold', x: '62%', y: '72%', icon: '✦' },
];

function Guide() {
  const [open, setOpen] = useState(false);
  return <button className={`guide ${open ? 'open' : ''}`} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="刘看山：打开地图提示">
    <span className="guide-avatar"><img src="/assets/liukanshan-guide.gif" alt="刘看山向导" /></span>
    <span className="guide-name">刘看山向导</span>
  </button>;
}

function MapNode({ place }: { place: typeof places[number] }) {
  return <Link to={`/jobs/job_replay_pm_intern?route=${place.id}`} className={`map-node ${place.tone}`} style={{ left: place.x, top: place.y }} aria-label={`${place.title}：${place.subtitle}`}>
    <span className="node-building" aria-hidden="true"><span>{place.icon}</span></span>
    <span className="node-plaque"><strong>{place.title} · {place.subtitle}</strong></span>
  </Link>;
}

function Home() {
  const navigate = useNavigate();
  return <main className="world-page">
    <section className="map-shell" aria-label="知乎经验地图首页">
      <div className="sky-layer" /><div className="hill-layer" /><div className="river-layer" />
      <div className="tree tree-a" /><div className="tree tree-b" /><div className="tree tree-c" /><div className="tree tree-d" />
      <div className="road road-main" /><div className="road road-south" />
      <article className="quest-note"><span>出发便签 · 视觉方向验证稿</span><h1>把建议，走成一条路</h1><p>地图即首页 · 地点即功能 · 向导即反馈</p></article>
      <aside className="guide-card"><strong>小山 · 路线提示</strong><p>先走一条你能坚持的路</p><small>Hover 地点查看说明</small></aside>
      <Link className="central-building" to="/maps/map_replay_pm_intern" aria-label="经验石碑：选择一条路线"><span className="stone-cap" /><strong>经验石碑</strong><small>选择一条路线</small></Link>
      {places.map((place) => <MapNode key={place.id} place={place} />)}
      <Guide />
      <button className="evidence-stamp" onClick={() => navigate('/maps/map_replay_pm_intern')}><strong>证据邮票 #02</strong><span>点击打开知乎原文</span></button>
      <div className="map-mark map-mark-left">概念视觉例图 · 非最终成品 · 仅用于审核方向</div><div className="map-mark map-mark-right">PIXEL GAME WORLD / 01</div>
    </section>
  </main>;
}

function Job() { return <main className="sub-page"><Link to="/" className="back-link">← 回到地图</Link><div className="sub-panel"><span className="eyebrow">驿站 · 01</span><h1>正在整理你的经验地图</h1><p>小山正在沿着地图寻找可核对的路线。</p><div className="stations"><span className="active">排队中</span><span>查找知乎内容</span><span>整理经验路线</span><span>检查来源</span></div><Link className="wood-button" to="/maps/map_replay_pm_intern">进入演示地图</Link></div></main>; }
function Map() { return <main className="sub-page"><Link to="/" className="back-link">← 回到地图</Link><div className="sub-panel"><span className="eyebrow">路线大厅</span><h1>大学生如何准备第一份产品经理实习？</h1><p>小山已经找到 3 个可以探索的地点。选择一条路线开始。</p><div className="route-list">{places.map(p => <Link key={p.id} to={`/maps/map_replay_pm_intern/plan?routeId=route_${p.id}`}><strong>{p.title}</strong><span>{p.subtitle}</span><b>进入 →</b></Link>)}</div></div></main>; }
function Plan() { return <main className="sub-page"><Link to="/maps/map_replay_pm_intern" className="back-link">← 回到路线大厅</Link><div className="sub-panel"><span className="eyebrow">行动背包</span><h1>先做一个可展示项目</h1><p>建议安排：第 1–2 周。完成后回来点亮下一站。</p><label className="task-row"><input type="checkbox" /> <span><strong>选择一个两周内能完成的用户问题</strong><small>完成判据：写出目标用户、问题和验证方式</small></span></label><button className="wood-button">导出行动手册</button></div></main>; }
function App() { return <Routes><Route path="/" element={<Home />} /><Route path="/jobs/:jobId" element={<Job />} /><Route path="/maps/:mapId" element={<Map />} /><Route path="/maps/:mapId/plan" element={<Plan />} /></Routes>; }
createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>);
