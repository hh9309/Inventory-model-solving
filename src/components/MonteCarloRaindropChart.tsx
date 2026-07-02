import React, { useEffect, useRef, useState } from "react";
import { Sparkles, Scissors, Info, Play, RefreshCw, Layers } from "lucide-react";
import { NewsboyParams, CalculationResults } from "../types";

interface RaindropChartProps {
  newsboyParams: NewsboyParams;
  results: CalculationResults;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  bucketIdx: number;
  speed: number;
  delay: number;
  color: string;
  size: number;
  landed: boolean;
  value: number;
}

export default function MonteCarloRaindropChart({ newsboyParams, results }: RaindropChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [particleCount, setParticleCount] = useState<number>(400);
  const [isRaining, setIsRaining] = useState<boolean>(true);
  const [triggerKey, setTriggerKey] = useState<number>(0);
  const [landedCount, setLandedCount] = useState<number>(0);

  // Theoretical calculations
  const mean = newsboyParams.mean || 500;
  const stdDev = newsboyParams.stdDev || 100;
  const minD = newsboyParams.minDemand || 200;
  const maxD = newsboyParams.maxDemand || 800;
  const isNormal = newsboyParams.distribution === "normal";
  const Q_opt = results.Q_opt || mean;
  const Cu = newsboyParams.Cu || 50;
  const Co = newsboyParams.Co || 30;
  
  // Critical ratio = Cu / (Cu + Co)
  const criticalRatio = Cu / (Cu + Co);

  // Re-run simulation whenever parameters or manual trigger change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI retina screens
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 280 * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = 280;
    const paddingLeft = 40;
    const paddingRight = 40;
    const paddingTop = 30;
    const paddingBottom = 40;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    // Determine domain bounds
    let domainMin = isNormal ? mean - 3 * stdDev : minD - 50;
    let domainMax = isNormal ? mean + 3 * stdDev : maxD + 50;
    if (domainMin < 0) domainMin = 0;

    const domainRange = domainMax - domainMin;

    // Helper to map values to canvas X coordinates
    const getX = (val: number) => {
      const pct = (val - domainMin) / domainRange;
      return paddingLeft + pct * chartWidth;
    };

    // Helper to map canvas X coordinates back to values
    const getValueFromX = (x: number) => {
      const pct = (x - paddingLeft) / chartWidth;
      return domainMin + pct * domainRange;
    };

    // Setup buckets
    const bucketCount = 30;
    const bucketWidth = chartWidth / bucketCount;
    const buckets = Array.from({ length: bucketCount }).map(() => ({
      count: 0,
      maxCount: 0,
      currentYOffset: height - paddingBottom,
    }));

    // Perform Monte Carlo sampling to generate demands
    const samples: number[] = [];
    for (let i = 0; i < particleCount; i++) {
      let sample = 0;
      if (isNormal) {
        // Box-Muller transform
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        sample = Math.round(num * stdDev + mean);
      } else {
        sample = Math.round(Math.random() * (maxD - minD) + minD);
      }
      if (sample < domainMin) sample = domainMin;
      if (sample > domainMax) sample = domainMax;
      samples.push(sample);
    }

    // Sort samples to draw theoretical shape if needed, but keep them randomized for arrival
    const particles: Particle[] = samples.map((val, idx) => {
      // Find which bucket this sample belongs to
      const pct = (val - domainMin) / domainRange;
      let bucketIdx = Math.floor(pct * bucketCount);
      if (bucketIdx >= bucketCount) bucketIdx = bucketCount - 1;
      if (bucketIdx < 0) bucketIdx = 0;

      const targetX = paddingLeft + bucketIdx * bucketWidth + bucketWidth / 2;
      
      // Determine color:
      // Left of Q_opt -> Overage / Stock Available (Indigo/Slate Blue)
      // Right of Q_opt -> Shortage / Stockout (Amber/Red)
      const color = val <= Q_opt 
        ? "rgba(99, 102, 241, 0.75)" // Indigo
        : "rgba(239, 68, 68, 0.75)";  // Rose

      return {
        id: idx,
        x: targetX + (Math.random() * 8 - 4), // slight horizontal dispersion as they fall
        y: -Math.random() * 200 - 10, // staggered initial heights
        targetX,
        targetY: height - paddingBottom, // will be dynamically updated as buckets pile up
        bucketIdx,
        speed: 3 + Math.random() * 4,
        delay: Math.floor(Math.random() * 120), // staggered starting frame delay
        color,
        size: 2 + Math.random() * 1.5,
        landed: false,
        value: val
      };
    });

    let animFrameId: number;
    let localLanded = 0;

    // Reset buckets counts
    buckets.forEach(b => b.count = 0);

    const drawLineAndCurve = () => {
      // 1. Draw Axis lines
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(paddingLeft, height - paddingBottom);
      ctx.lineTo(width - paddingRight, height - paddingBottom);
      ctx.stroke();

      // 2. Overlay theoretical PDF curve (Smooth fit)
      ctx.strokeStyle = "rgba(100, 116, 139, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();

      const step = 4;
      for (let x = paddingLeft; x <= width - paddingRight; x += step) {
        const val = getValueFromX(x);
        let pdf = 0;
        if (isNormal) {
          const exponent = -Math.pow(val - mean, 2) / (2 * Math.pow(stdDev, 2));
          pdf = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
          // Scale PDF to fit chart height
          const maxPdf = 1 / (stdDev * Math.sqrt(2 * Math.PI));
          const y = height - paddingBottom - (pdf / maxPdf) * (chartHeight * 0.85);
          if (x === paddingLeft) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        } else {
          // Uniform PDF
          if (val >= minD && val <= maxD) {
            const y = height - paddingBottom - chartHeight * 0.6;
            if (x === paddingLeft) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          } else {
            const y = height - paddingBottom;
            if (x === paddingLeft) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
        }
      }
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash

      // 3. Draw Optimal Order Quantity Q* Cut Line (Golden Razor)
      const qX = getX(Q_opt);
      if (qX >= paddingLeft && qX <= width - paddingRight) {
        // Left side tint (Optimal Overage range - Blue tint)
        ctx.fillStyle = "rgba(99, 102, 241, 0.04)";
        ctx.fillRect(paddingLeft, paddingTop, qX - paddingLeft, chartHeight);

        // Right side tint (Shortage risk range - Red tint)
        ctx.fillStyle = "rgba(239, 68, 68, 0.04)";
        ctx.fillRect(qX, paddingTop, width - paddingRight - qX, chartHeight);

        // Gold Cut line
        ctx.strokeStyle = "#eab308";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(qX, paddingTop - 5);
        ctx.lineTo(qX, height - paddingBottom + 5);
        ctx.stroke();

        // Label on Q* line
        ctx.fillStyle = "#eab308";
        ctx.font = "bold 10px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`最优订购 Q* = ${Math.round(Q_opt)}`, qX, paddingTop - 10);

        // Draw Scissor Node
        ctx.fillStyle = "#fef08a";
        ctx.strokeStyle = "#ca8a04";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(qX, paddingTop + 20, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // 4. Draw labels on X-axis
      ctx.fillStyle = "#64748b";
      ctx.font = "9px JetBrains Mono, monospace";
      ctx.textAlign = "center";
      
      // Min label
      ctx.fillText(Math.round(domainMin).toString(), paddingLeft, height - paddingBottom + 15);
      // Max label
      ctx.fillText(Math.round(domainMax).toString(), width - paddingRight, height - paddingBottom + 15);
      // Mean label
      if (isNormal) {
        ctx.fillText(`均值 μ:${Math.round(mean)}`, getX(mean), height - paddingBottom + 15);
      } else {
        ctx.fillText(`区间 [${Math.round(minD)}, ${Math.round(maxD)}]`, getX((minD + maxD) / 2), height - paddingBottom + 15);
      }
    };

    const runLoop = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw static/theoretical backgrounds
      drawLineAndCurve();

      // Update and Draw Landed Buckets (building the histogram)
      const maxLandedInBucket = Math.max(...buckets.map(b => b.count), 1);
      
      buckets.forEach((bucket, bIdx) => {
        if (bucket.count > 0) {
          const x = paddingLeft + bIdx * bucketWidth;
          // Calculate height dynamically. Scale it so it fits nicely.
          const maxSimHeight = chartHeight * 0.75;
          const targetH = (bucket.count / particleCount) * 10 * maxSimHeight;
          const h = Math.min(chartHeight - 10, targetH);
          const y = height - paddingBottom - h;

          // Determine color based on bucket midpoint relative to Q*
          const midVal = domainMin + (bIdx + 0.5) * (domainRange / bucketCount);
          const baseColor = midVal <= Q_opt 
            ? "rgba(129, 140, 248, 0.85)" // Soft Indigo
            : "rgba(248, 113, 113, 0.85)";  // Soft Rose

          ctx.fillStyle = baseColor;
          ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
          ctx.lineWidth = 0.5;

          // Draw pill rounded bucket bar
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(x + 1, y, bucketWidth - 2, h, [3, 3, 0, 0]);
          } else {
            ctx.rect(x + 1, y, bucketWidth - 2, h);
          }
          ctx.fill();
          ctx.stroke();

          // Keep track of current top Y for falling particle landing physics
          bucket.currentYOffset = y;
        } else {
          bucket.currentYOffset = height - paddingBottom;
        }
      });

      // Update and Draw Rain particles
      let activeRainFound = false;
      particles.forEach(p => {
        if (p.landed) {
          return; // Skip drawing landed particles as they merged into the histogram
        }

        if (p.delay > 0) {
          p.delay--;
          activeRainFound = true;
          return;
        }

        activeRainFound = true;

        // Move particle downward
        p.y += p.speed;

        // Determine target Y based on current pile height of its bucket
        const currentPileY = buckets[p.bucketIdx].currentYOffset;

        // Land detection
        if (p.y >= currentPileY) {
          p.landed = true;
          buckets[p.bucketIdx].count += 1;
          localLanded++;
          setLandedCount(localLanded);
        } else {
          // Draw falling raindrop (stretched line or soft dot)
          ctx.fillStyle = p.color;
          ctx.beginPath();
          // Draw stretched raindrop line
          ctx.ellipse(p.x, p.y, p.size / 1.5, p.size * 1.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      if (activeRainFound) {
        animFrameId = requestAnimationFrame(runLoop);
      } else {
        setIsRaining(false);
      }
    };

    runLoop();

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [triggerKey, particleCount, mean, stdDev, minD, maxD, isNormal, Q_opt, Cu, Co]);

  const triggerShower = () => {
    setLandedCount(0);
    setIsRaining(true);
    setTriggerKey(prev => prev + 1);
  };

  return (
    <div id="monte-carlo-raindrop-root" className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 mt-6 relative overflow-hidden">
      
      {/* Absolute floating sparkles background */}
      <div className="absolute top-3 right-3 opacity-10 animate-pulse pointer-events-none">
        <Sparkles className="w-16 h-16 text-indigo-600" />
      </div>

      {/* Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 mb-4 border-b border-slate-200">
        <div>
          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wide flex items-center gap-1 w-fit">
            <Layers className="w-3 h-3 text-emerald-600 animate-spin-slow" />
            蒙特卡洛随机模拟 (Stochastic Rain Simulation)
          </span>
          <h4 className="text-sm font-black text-slate-800 mt-1">
            随机需求“雨滴”落雨堆积直方图与最优剪刀差切面
          </h4>
          <p className="text-[11px] text-slate-500 mt-0.5">
            静默执行 <strong>{particleCount}</strong> 次随机客户需求抽样，雨滴落下碰撞堆积拟合出概率分布，金色最优剪切面划定滞销风险与脱销损失。
          </p>
        </div>

        {/* Trigger Controls */}
        <div className="flex items-center gap-2">
          {/* Sample Size selector */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs text-slate-500">
            <span className="font-semibold text-[10px] uppercase">样本数:</span>
            <select
              value={particleCount}
              onChange={(e) => {
                setParticleCount(parseInt(e.target.value));
                setTriggerKey(prev => prev + 1);
              }}
              className="font-mono font-bold text-indigo-600 bg-transparent outline-none cursor-pointer text-xs"
            >
              <option value="200">200 次</option>
              <option value="400">400 次</option>
              <option value="800">800 次</option>
            </select>
          </div>

          <button
            type="button"
            onClick={triggerShower}
            className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-700 hover:border-indigo-800 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-xs font-bold shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRaining ? "animate-spin" : ""}`} />
            重新落雨实验
          </button>
        </div>
      </div>

      {/* Main Graph Canvas and Legends inside a grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        
        {/* The Live Interactive Canvas Column (8 cols) */}
        <div ref={containerRef} className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-3 relative shadow-inner">
          <canvas ref={canvasRef} className="w-full block h-[280px]" />
          
          {/* Floating Live counter */}
          <div className="absolute bottom-2 right-4 text-[10px] font-mono text-slate-400 font-extrabold bg-slate-50/80 px-2 py-0.5 rounded border border-slate-100">
            已着陆: {landedCount} / {particleCount}
          </div>
        </div>

        {/* The Explanatory & Legend Column (4 cols) */}
        <div className="lg:col-span-4 flex flex-col justify-between gap-4 h-full">
          
          {/* Legend Details */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex-1">
            <h5 className="text-[10px] font-black text-slate-700 uppercase tracking-wide border-b border-slate-100 pb-1.5 mb-3 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-indigo-500" />
              期末决策边际平衡解析
            </h5>

            <div className="space-y-3.5 text-xs">
              
              {/* Indigo Region */}
              <div className="flex items-start gap-2.5">
                <div className="w-3 h-3 rounded bg-indigo-400 mt-0.5 shrink-0" />
                <div>
                  <div className="font-extrabold text-slate-800 flex items-center gap-1">
                    <span>滞销堆积区间 (Overage Zone)</span>
                    <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1 rounded">需求 ≤ Q*</span>
                  </div>
                  <p className="text-[10.5px] text-slate-500 mt-0.5 leading-relaxed">
                    顾客需求未达到您的订货量。左侧堆积的雨滴代表<strong>滞销积压</strong>的数量，每个单位将造成 <strong>Co = ¥{Co}</strong> 的积压折价/报废损失。
                  </p>
                </div>
              </div>

              {/* Rose Region */}
              <div className="flex items-start gap-2.5">
                <div className="w-3 h-3 rounded bg-red-400 mt-0.5 shrink-0" />
                <div>
                  <div className="font-extrabold text-slate-800 flex items-center gap-1">
                    <span>脱销缺货区间 (Shortage Zone)</span>
                    <span className="text-[9px] bg-rose-50 text-rose-600 px-1 rounded">需求 &gt; Q*</span>
                  </div>
                  <p className="text-[10.5px] text-slate-500 mt-0.5 leading-relaxed">
                    顾客需求超出您的订购量。右侧堆积的雨滴代表<strong>买不到商品的脱销顾客</strong>，每个单位造成 <strong>Cu = ¥{Cu}</strong> 的机会利润流失。
                  </p>
                </div>
              </div>

              {/* Critical Ratio Cut Line */}
              <div className="flex items-start gap-2.5 border-t border-slate-100 pt-3">
                <Scissors className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-extrabold text-amber-700">
                    临界比率切面 (Critical Ratio): { (criticalRatio * 100).toFixed(1) }%
                  </div>
                  <p className="text-[10.5px] text-slate-500 mt-0.5 leading-relaxed">
                    根据运筹公式 <strong>Cu / (Cu + Co)</strong> 算得。金色最优剪刀在此处剪开，使得恰好有 <strong>{ (criticalRatio * 100).toFixed(0) }%</strong> 的概率不发生脱销，从而锁定最大期望利润。
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* Tips box */}
          <div className="bg-amber-50/50 border border-amber-200/60 p-3 rounded-xl">
            <span className="text-[10px] text-amber-800 font-extrabold uppercase block tracking-wide">💡 动态感知：</span>
            <p className="text-[10px] text-amber-700 leading-relaxed mt-0.5">
              尝试在上方修改<strong>缺货损失 Cu</strong> 或<strong>积压 Co</strong> 的值，金色切线将自适应左右平滑滑动。越高的缺货损失会让金色切片右移，代表报童宁可多备货，也不愿得罪到店顾客！
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
