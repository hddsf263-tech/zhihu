import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import './styles.css';

function Home() { return <main><h1>知乎经验地图</h1><p>把零散经验，变成看得懂、能比较、有出处的下一步。</p><Link to="/jobs/job_replay_pm_intern">查看演示案例</Link></main>; }
function Job() { return <main><h1>正在整理经验</h1><p>查找知乎内容 · 整理经验路线 · 检查来源</p><Link to="/maps/map_replay_pm_intern">进入演示地图</Link></main>; }
function Map() { return <main><h1>大学生如何准备第一份产品经理实习？</h1><p>演示案例：合成测试数据，不代表实时请求</p><Link to="/maps/map_replay_pm_intern/plan?routeId=route_portfolio">选择路线并生成清单</Link></main>; }
function Plan() { return <main><h1>行动清单</h1><label><input type="checkbox" /> 完成一个可展示项目</label></main>; }
function App() { return <Routes><Route path="/" element={<Home />} /><Route path="/jobs/:jobId" element={<Job />} /><Route path="/maps/:mapId" element={<Map />} /><Route path="/maps/:mapId/plan" element={<Plan />} /></Routes>; }
createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>);
