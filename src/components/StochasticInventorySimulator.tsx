import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Truck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Info,
  Layers,
  Activity,
  Package,
  DollarSign,
  User,
  ShoppingBag,
  Smile,
  Frown,
  HelpCircle,
  AlertCircle,
  Warehouse,
  Clock
} from "lucide-react";
import { ModelType, EOQParams, ShortageParams, EPQParams, NewsboyParams, ThresholdParams, CalculationResults } from "../types";
import MonteCarloRaindropChart from "./MonteCarloRaindropChart";

// Box-Muller transform for normally distributed stochastic demands
function randomNormal(mean: number, stdDev: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return Math.round(num * stdDev + mean);
}

// Uniformly distributed stochastic demands
function randomUniform(min: number, max: number): number {
  return Math.round(Math.random() * (max - min) + min);
}

interface SimulatorProps {
  activeModel: ModelType;
  eoqParams: EOQParams;
  shortageParams: ShortageParams;
  epqParams: EPQParams;
  newsboyParams: NewsboyParams;
  thresholdParams: ThresholdParams;
  results: CalculationResults;
}

interface NewsboyCustomer {
  id: number;
  time: string;
  demandQty: number;
  purchasedQty: number;
  outcome: "success" | "shortage" | "partial";
  iconType: number;
}

export default function StochasticInventorySimulator({
  activeModel,
  eoqParams,
  shortageParams,
  epqParams,
  newsboyParams,
  thresholdParams,
  results
}: SimulatorProps) {
  // Common states
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(5); // simulated days per real-time second

  // ----------------------------------------------------
  // CONTINUOUS MODELS SIMULATION STATE (EOQ, SHORTAGE, EPQ)
  // ----------------------------------------------------
  const [currentInv, setCurrentInv] = useState<number>(0);
  const [simTime, setSimTime] = useState<number>(0);
  const [truckState, setTruckState] = useState<"idle" | "transit" | "replenishing" | "producing">("idle");
  const [leadTimeProgress, setLeadTimeProgress] = useState<number>(0); // 0 to 1
  const [epqProdProgress, setEpqProdProgress] = useState<number>(0); // 0 to 1
  const [hasOrdered, setHasOrdered] = useState<boolean>(false);
  const [splashActive, setSplashActive] = useState<boolean>(false);
  const [lastReplenishQty, setLastReplenishQty] = useState<number>(0);
  
  // Wave phase for water rippling SVG
  const [wavePhase, setWavePhase] = useState<number>(0);

  // Synchronize simulation variables when sliders/parameters update
  useEffect(() => {
    // Determine target initial inventory level
    const Q = results.Q_opt || 500;
    const S = results.S_opt || 0;
    // Start simulation at maximum inventory level
    setCurrentInv(Q - S);
    setSimTime(0);
    setTruckState("idle");
    setLeadTimeProgress(0);
    setEpqProdProgress(0);
    setHasOrdered(false);
  }, [activeModel, eoqParams, shortageParams, epqParams, thresholdParams, results.Q_opt, results.S_opt]);

  // Main animation / simulation loop for Continuous Models
  useEffect(() => {
    if (!isPlaying || activeModel === ModelType.NEWSBOY) return;

    let lastTime = performance.now();
    let frameId: number;

    const tick = (now: number) => {
      const deltaSec = (now - lastTime) / 1000;
      lastTime = now;

      // Avoid giant jumps if tab goes in background
      const cappedDeltaSec = Math.min(deltaSec, 0.1);

      // Convert real-time seconds to simulated days
      const deltaDays = cappedDeltaSec * simSpeed;

      // Get parameters for the active model
      let D = 8000;
      let L = 10;
      let Q = results.Q_opt || 500;
      let S = results.S_opt || 0;
      let P = 24000;
      let ROP = results.ROP || 0;

      if (activeModel === ModelType.EOQ) {
        D = eoqParams.D;
        L = eoqParams.L;
      } else if (activeModel === ModelType.SHORTAGE) {
        D = shortageParams.D;
        L = shortageParams.L;
      } else if (activeModel === ModelType.EPQ) {
        D = epqParams.D;
        L = epqParams.L;
        P = epqParams.P;
      } else if (activeModel === ModelType.THRESHOLD) {
        D = thresholdParams.D;
        L = thresholdParams.L;
        ROP = results.ROP || 0;
      }

      let demandPerDay = D / 365;
      if (activeModel === ModelType.THRESHOLD) {
        const stepMean = (thresholdParams.D / 365) * deltaDays;
        const stepStd = thresholdParams.sigmaDaily * Math.sqrt(deltaDays);
        demandPerDay = randomNormal(stepMean, stepStd) / deltaDays;
        if (demandPerDay < 0) demandPerDay = 0;
      }

      const productionPerDay = P / 365;

      setSimTime(prev => prev + deltaDays);
      setWavePhase(prev => (prev + deltaDays * 2) % (Math.PI * 2));

      setCurrentInv(prevInv => {
        let nextInv = prevInv;

        if (truckState === "producing") {
          // EPQ model is replenishment by continuous production (production rate minus demand rate)
          const netRate = productionPerDay - demandPerDay;
          nextInv = prevInv + netRate * deltaDays;

          // Track production progress
          const tp = (Q / P) * 365; // production duration in days
          setEpqProdProgress(prevProg => {
            const nextProg = prevProg + deltaDays / tp;
            if (nextProg >= 1) {
              // Finished production
              setTruckState("idle");
              setHasOrdered(false);
              setSplashActive(true);
              setTimeout(() => setSplashActive(false), 800);
              return 0;
            }
            return nextProg;
          });
        } else {
          // Standard consumption
          nextInv = prevInv - demandPerDay * deltaDays;
        }

        // TRIGGER REORDER POINT (ROP)
        // If we drop below ROP, have not ordered yet, and have no active delivery
        if (nextInv <= ROP && !hasOrdered && truckState === "idle") {
          setHasOrdered(true);
          setTruckState("transit");
          setLeadTimeProgress(0);
        }

        // HANDLE TRUCK IN TRANSIT
        if (truckState === "transit") {
          setLeadTimeProgress(prevProg => {
            const nextProg = prevProg + deltaDays / L;
            if (nextProg >= 1) {
              // Truck has arrived at warehouse
              if (activeModel === ModelType.EPQ) {
                // Starts continuous production ramp up
                setTruckState("producing");
                setEpqProdProgress(0);
              } else {
                // Instantaneous delivery receipt (EOQ, SHORTAGE or THRESHOLD)
                setTruckState("idle");
                setHasOrdered(false);
                setLastReplenishQty(Q);
                setSplashActive(true);
                setTimeout(() => setSplashActive(false), 800);
                
                // Add replenishment amount to physical inventory
                return 0; // resets progress
              }
            }
            return nextProg;
          });

          // In standard EOQ/SHORTAGE, the trigger is added to inventory at the exact tick progress hits 1.
          // Since we're tracking state on nextInv, let's inject it if leadTimeProgress is about to hit 1.
          // Better yet, just wait for leadTimeProgress to update inside the state setter.
        }

        // For instantaneous receipt, we simulate the bounce
        return nextInv;
      });

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying, simSpeed, activeModel, eoqParams, shortageParams, epqParams, thresholdParams, results, truckState, hasOrdered]);

  // Handle instantaneous inventory receipt when transit is finished
  useEffect(() => {
    if (truckState === "idle" && hasOrdered && leadTimeProgress >= 0.99) {
      // In case we transitioned to idle from transit
      const Q = results.Q_opt || 500;
      setCurrentInv(prev => prev + Q);
      setHasOrdered(false);
      setLeadTimeProgress(0);
    }
  }, [truckState, hasOrdered, leadTimeProgress, results.Q_opt]);

  // Reset continuous simulation
  const handleResetContinuous = () => {
    const Q = results.Q_opt || 500;
    const S = results.S_opt || 0;
    setCurrentInv(Q - S);
    setSimTime(0);
    setTruckState("idle");
    setLeadTimeProgress(0);
    setEpqProdProgress(0);
    setHasOrdered(false);
  };

  // ----------------------------------------------------
  // NEWSBOY STOCHASTIC SINGLE-PERIOD DAY STATE & LOGIC
  // ----------------------------------------------------
  const [nbSimState, setNbSimState] = useState<"idle" | "running" | "ended">("idle");
  const [nbInventory, setNbInventory] = useState<number>(0);
  const [nbQOrdered, setNbQOrdered] = useState<number>(0);
  const [nbTotalDemand, setNbTotalDemand] = useState<number>(0);
  const [nbSales, setNbSales] = useState<number>(0);
  const [nbShortage, setNbShortage] = useState<number>(0);
  const [nbHour, setNbHour] = useState<number>(8); // 8:00 AM to 6:00 PM (8 to 18)
  const [nbMinutes, setNbMinutes] = useState<number>(0);
  const [nbCustomers, setNbCustomers] = useState<NewsboyCustomer[]>([]);
  const [nbCurrentCustomer, setNbCurrentCustomer] = useState<NewsboyCustomer | null>(null);
  const [nbRevenue, setNbRevenue] = useState<number>(0);
  const [nbPurchasingCost, setNbPurchasingCost] = useState<number>(0);
  const [nbScrapSalvage, setNbScrapSalvage] = useState<number>(0);
  const [nbShortageLoss, setNbShortageLoss] = useState<number>(0);

  // Suggested values for Newsboy economics
  const nbPrice = 100; // default selling price
  const nbCost = nbPrice - newsboyParams.Cu; // cost derived from marginal profit Cu
  const nbScrap = nbCost - newsboyParams.Co; // scrap derived from marginal loss Co

  // Set initial default Newsboy ordered size
  useEffect(() => {
    if (activeModel === ModelType.NEWSBOY) {
      setNbQOrdered(Math.round(results.Q_opt || newsboyParams.mean));
    }
  }, [activeModel, results.Q_opt, newsboyParams.mean]);

  // Newsboy Simulation loop
  useEffect(() => {
    if (activeModel !== ModelType.NEWSBOY || nbSimState !== "running") return;

    let timer: NodeJS.Timeout;
    let localHour = nbHour;
    let localMin = nbMinutes;
    let remainingInv = nbInventory;
    let localSales = nbSales;
    let localShortage = nbShortage;
    let customerIdCounter = nbCustomers.length;

    // We distribute demand randomly over the day
    // Generate actual demand first
    const demandToDistribute = nbTotalDemand;
    
    // Create random arrivals of customers
    const totalCustomersCount = Math.max(5, Math.round(demandToDistribute / 5 + Math.random() * 5));
    const arrivalIntervals = 600 / totalCustomersCount; // simulated minutes between arrivals

    const tick = () => {
      // Advance clock by 10 minutes
      localMin += 10;
      if (localMin >= 60) {
        localHour += 1;
        localMin = 0;
      }

      setNbHour(localHour);
      setNbMinutes(localMin);

      // Check customer arrival
      const currentSimTimeInMins = (localHour - 8) * 60 + localMin;
      const shouldCustomerArrive = currentSimTimeInMins % Math.round(arrivalIntervals) === 0 && localHour < 18;

      if (shouldCustomerArrive) {
        // Stochastic customer request
        const customerDemand = Math.max(1, Math.round(demandToDistribute / totalCustomersCount + (Math.random() * 4 - 2)));
        
        let purchased = 0;
        let outcome: "success" | "shortage" | "partial" = "success";

        if (remainingInv >= customerDemand) {
          purchased = customerDemand;
          remainingInv -= customerDemand;
          localSales += purchased;
          outcome = "success";
        } else if (remainingInv > 0) {
          purchased = remainingInv;
          const unmet = customerDemand - remainingInv;
          remainingInv = 0;
          localSales += purchased;
          localShortage += unmet;
          outcome = "partial";
        } else {
          purchased = 0;
          localShortage += customerDemand;
          outcome = "shortage";
        }

        const newCustomer: NewsboyCustomer = {
          id: customerIdCounter++,
          time: `${localHour.toString().padStart(2, "0")}:${localMin.toString().padStart(2, "0")}`,
          demandQty: customerDemand,
          purchasedQty: purchased,
          outcome,
          iconType: Math.floor(Math.random() * 4)
        };

        setNbCustomers(prev => [newCustomer, ...prev.slice(0, 5)]);
        setNbCurrentCustomer(newCustomer);
        setNbInventory(remainingInv);
        setNbSales(localSales);
        setNbShortage(localShortage);

        // Clear active current customer display after 1.5s
        setTimeout(() => setNbCurrentCustomer(null), 1200);
      }

      // Check end of day (6:00 PM / 18:00)
      if (localHour >= 18) {
        setNbSimState("ended");
        // Calculate financial ledger
        const revenue = localSales * nbPrice;
        const purchaseCost = nbQOrdered * nbCost;
        const salvageValue = remainingInv * nbScrap;
        // shortage penalty is unmet demand multiplied by missed opportunity profit (Cu)
        const penCost = localShortage * newsboyParams.Cu;

        setNbRevenue(revenue);
        setNbPurchasingCost(purchaseCost);
        setNbScrapSalvage(salvageValue);
        setNbShortageLoss(penCost);
        return;
      }

      timer = setTimeout(tick, 250); // fast simulation pace
    };

    timer = setTimeout(tick, 250);
    return () => clearTimeout(timer);
  }, [nbSimState, nbHour, nbMinutes, activeModel, nbTotalDemand, nbQOrdered, newsboyParams.Cu, newsboyParams.Co]);

  // Start Newsboy simulation
  const handleStartNewsboySim = () => {
    // Determine demand based on parameters
    let totalDemand = 0;
    if (newsboyParams.distribution === "normal") {
      totalDemand = Math.max(0, randomNormal(newsboyParams.mean, newsboyParams.stdDev));
    } else {
      totalDemand = randomUniform(newsboyParams.minDemand, newsboyParams.maxDemand);
    }

    setNbTotalDemand(totalDemand);
    setNbInventory(nbQOrdered);
    setNbSales(0);
    setNbShortage(0);
    setNbHour(8);
    setNbMinutes(0);
    setNbCustomers([]);
    setNbCurrentCustomer(null);
    setNbSimState("running");
  };

  // ----------------------------------------------------
  // PHYSICAL COORDINATE & WAVE CALCULATIONS FOR WATER RESEVIOR
  // ----------------------------------------------------
  // Dynamic scaling for water reservoir level representation
  const Q_opt = results.Q_opt || 500;
  const S_opt = results.S_opt || 0;
  const I_max = results.I_max !== undefined ? results.I_max : Q_opt;

  // Let's establish standard capacity of the reservoir tank
  const tankCapacityMax = Math.max(I_max, Q_opt) * 1.1;
  const tankCapacityMin = activeModel === ModelType.SHORTAGE ? -S_opt * 1.3 : 0;
  const tankCapacityRange = tankCapacityMax - tankCapacityMin;

  const getInventoryPct = (val: number) => {
    const clamped = Math.min(Math.max(val, tankCapacityMin), tankCapacityMax);
    return ((clamped - tankCapacityMin) / tankCapacityRange) * 100;
  };

  const inventoryPct = getInventoryPct(currentInv);
  const zeroPct = getInventoryPct(0);

  // Generate beautiful wavy liquid path for reservoir water using Bézier curves
  const drawWaterWavePath = () => {
    const width = 180;
    const height = 150;
    const waterY = height - (inventoryPct / 100) * height;
    
    // Wave parameters
    const waveAmp = isPlaying ? 3 : 1; // higher ripples if simulating
    const waveFreq = 0.05;
    
    let path = `M 0,${waterY}`;
    for (let x = 0; x <= width; x += 10) {
      const dy = Math.sin(x * waveFreq + wavePhase) * waveAmp;
      path += ` L ${x},${Math.min(height, Math.max(0, waterY + dy))}`;
    }
    path += ` L ${width},${height} L 0,${height} Z`;
    return path;
  };

  return (
    <div id="stochastic-inventory-simulator-wrapper" className="bg-slate-50 rounded-2xl border border-slate-200/80 p-5 mt-6 relative overflow-hidden">
      
      {/* Decorative background grid lines */}
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] pointer-events-none" />

      {/* Header Info Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-4 mb-5 border-b border-slate-200 relative z-10">
        <div>
          <span className="text-[10px] bg-indigo-100 text-indigo-800 font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wide flex items-center gap-1 w-fit">
            <Activity className="w-3 h-3 animate-pulse" />
            2D 吞吐仿真器 (Live Dynamic Visualizer)
          </span>
          <h4 className="text-sm font-black text-slate-800 mt-1">
            {activeModel === ModelType.NEWSBOY 
              ? "随机报童每日销售博弈吞吐" 
              : "动态库存水位蓄水池与物流轨道吞吐模型"}
          </h4>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {activeModel === ModelType.NEWSBOY
              ? "模拟报童订货 Q 件后一天的随机到访采购全流程，直观体现滞销毁损与脱销利润损失平衡。"
              : "观察库存随每日持续消耗，在跌入订货点（ROP）瞬间召唤货卡，展现交货期（Lead Time）在途缓冲过程。"}
          </p>
        </div>

        {/* CONTROLS BAR */}
        {activeModel !== ModelType.NEWSBOY ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className={`p-2 rounded-xl border flex items-center gap-1.5 text-xs font-extrabold cursor-pointer transition-all ${
                isPlaying 
                  ? "bg-amber-500 hover:bg-amber-600 border-amber-600 text-white shadow-sm"
                  : "bg-indigo-600 hover:bg-indigo-700 border-indigo-700 text-white shadow-sm"
              }`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isPlaying ? "暂停仿真" : "继续仿真"}
            </button>
            <button
              type="button"
              onClick={handleResetContinuous}
              className="p-2 bg-white text-slate-600 hover:text-indigo-600 border border-slate-200 hover:bg-slate-50 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-xs font-semibold"
              title="复位至满格水位状态"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              复位
            </button>

            {/* SPEED SLIDER */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl ml-1 text-xs text-slate-500">
              <span className="font-semibold text-[10px] uppercase">倍速:</span>
              <input
                type="range"
                min="1"
                max="25"
                value={simSpeed}
                onChange={(e) => setSimSpeed(parseInt(e.target.value))}
                className="w-16 accent-indigo-600 cursor-pointer h-1"
              />
              <span className="font-mono font-bold text-indigo-600">{simSpeed}d/s</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1 rounded-xl">
              <label htmlFor="nb-q-slider" className="text-[10px] font-extrabold text-slate-500 uppercase">
                调整订货量 Q:
              </label>
              <input
                id="nb-q-slider"
                type="range"
                min={Math.max(10, Math.round(newsboyParams.mean * 0.4))}
                max={Math.round(newsboyParams.mean * 1.6)}
                value={nbQOrdered}
                disabled={nbSimState === "running"}
                onChange={(e) => setNbQOrdered(parseInt(e.target.value))}
                className="w-24 accent-indigo-600 cursor-pointer h-1"
              />
              <span className="font-mono font-bold text-indigo-600 text-xs w-8 text-right">{nbQOrdered}</span>
            </div>

            <button
              type="button"
              onClick={handleStartNewsboySim}
              disabled={nbSimState === "running"}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs flex items-center gap-1 transition-all shadow-sm cursor-pointer disabled:cursor-not-allowed"
            >
              <Play className="w-3.5 h-3.5" />
              {nbSimState === "ended" ? "重新开始" : "开始单期仿真"}
            </button>
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------------------------- */}
      {/* VIEW A: CONTINUOUS STOCK WATER TANK SIMULATOR (EOQ, EPQ, SHORTAGE) */}
      {/* -------------------------------------------------------------------------------- */}
      {activeModel !== ModelType.NEWSBOY && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10 items-stretch">
          
          {/* LEFT: GRAPHIC PANEL - RESERVOIR, WATER LEVEL AND SPLASH (4 cols) */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center bg-white border border-slate-200 rounded-2xl p-4 relative min-h-[220px]">
            
            {/* Model Water Level Indicators */}
            <div className="absolute top-2 left-2 text-[10px] text-slate-400 font-mono font-semibold flex items-center gap-1.5">
              <span>水位刻度 (Scale)</span>
              {activeModel === ModelType.SHORTAGE && (
                <span className="bg-red-50 text-red-600 text-[9px] px-1 rounded border border-red-100">
                  支持延迟缺货负压
                </span>
              )}
            </div>

            {/* Warehouse Visual Wrapper */}
            <div className="relative w-[180px] h-[150px] border-4 border-slate-800 rounded-b-2xl rounded-t-lg bg-slate-900/5 shadow-inner overflow-hidden flex flex-col justify-end">
              
              {/* Shortage baseline separator */}
              {activeModel === ModelType.SHORTAGE && (
                <div 
                  className="absolute left-0 right-0 border-t-2 border-dashed border-red-400/80 z-20 text-center"
                  style={{ bottom: `${zeroPct}%` }}
                >
                  <span className="bg-red-500 text-white text-[8px] font-black px-1.5 py-0.2 rounded-full absolute -top-1.5 left-1/2 transform -translate-x-1/2 uppercase tracking-wide">
                    零库存基准线 (Zero Level)
                  </span>
                </div>
              )}

              {/* Water Wave (Positive Inventory) */}
              <div 
                className="absolute left-0 right-0 bottom-0 transition-all duration-300 ease-linear"
                style={{ 
                  height: `${inventoryPct}%`,
                  zIndex: 10
                }}
              >
                <svg className="w-full h-full" viewBox="0 0 180 150" preserveAspectRatio="none">
                  <path 
                    d={drawWaterWavePath()} 
                    fill={activeModel === ModelType.EPQ ? "url(#epqGrad)" : "url(#waterGrad)"} 
                    className="transition-all duration-300 ease-linear"
                  />
                  <defs>
                    <linearGradient id="waterGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#818cf8" stopOpacity="0.85" />
                      <stop offset="100%" stopColor="#3730a3" stopOpacity="0.95" />
                    </linearGradient>
                    <linearGradient id="epqGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.85" />
                      <stop offset="100%" stopColor="#0f766e" stopOpacity="0.95" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              {/* Red-tinted warning for shortage (Negative Inventory) */}
              {activeModel === ModelType.SHORTAGE && currentInv < 0 && (
                <div 
                  className="absolute left-0 right-0 bg-red-500/30 backdrop-blur-[0.5px] border-t-2 border-red-500 z-15 flex items-center justify-center animate-pulse"
                  style={{ 
                    bottom: `${inventoryPct}%`, 
                    top: `${100 - zeroPct}%` 
                  }}
                >
                  <span className="text-[9px] font-black text-red-700 bg-white/95 px-1 rounded shadow-xs">
                    延迟缺货: {Math.abs(currentInv).toFixed(0)} 件
                  </span>
                </div>
              )}

              {/* EPQ Production Pouring Pipe */}
              {truckState === "producing" && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-4 bg-slate-400 h-6 border-x border-slate-500 z-30 flex flex-col justify-end">
                  {/* Flowing liquid beam */}
                  <div className="w-2 mx-auto bg-teal-300 animate-bounce h-24 absolute top-6" style={{ width: "6px" }} />
                </div>
              )}

              {/* Splash Animation overlay */}
              {splashActive && (
                <div className="absolute inset-0 bg-indigo-500/20 z-25 flex items-center justify-center">
                  <div className="animate-ping bg-white w-14 h-14 rounded-full flex items-center justify-center">
                    <Sparkles className="w-7 h-7 text-indigo-600 animate-spin" />
                  </div>
                  <span className="absolute text-xs font-black text-indigo-950 bg-white border border-indigo-200 px-2 py-0.5 rounded-full shadow-md animate-bounce">
                    +{lastReplenishQty.toFixed(0)} 充能到货!
                  </span>
                </div>
              )}
            </div>

            {/* Micro details metrics */}
            <div className="mt-3 flex items-center gap-4 text-center">
              <div>
                <span className="text-[9px] text-slate-400 font-bold block uppercase">实时库存水位</span>
                <span className={`text-xs font-black font-mono ${currentInv < 0 ? "text-rose-600 animate-pulse" : "text-indigo-600"}`}>
                  {currentInv.toFixed(0)} 件
                </span>
              </div>
              <div className="border-l border-slate-200 pl-4">
                <span className="text-[9px] text-slate-400 font-bold block uppercase">水位容积率</span>
                <span className="text-xs font-black font-mono text-slate-700">
                  {Math.max(0, inventoryPct).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT: TRACK & METRICS PANEL - TRUCK TRAVEL (8 cols) */}
          <div className="lg:col-span-8 flex flex-col justify-between bg-white border border-slate-200 rounded-2xl p-5 relative min-h-[220px]">
            
            {/* Status indicators */}
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${
                  truckState === "transit" 
                    ? "bg-amber-500 animate-ping" 
                    : truckState === "producing"
                    ? "bg-teal-500 animate-pulse"
                    : "bg-slate-400"
                }`} />
                <span className="text-xs font-bold text-slate-700">
                  供应链物流链在途：
                  <span className="text-indigo-600">
                    {truckState === "transit" 
                      ? "货运途中 (Transit - ROP Triggered)" 
                      : truckState === "producing"
                      ? "产线全速排产中 (Continuous Production)"
                      : "待触发 (Warehouse Idle)"}
                  </span>
                </span>
              </div>

              <div className="text-[10px] font-mono font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg">
                累计运营时间: {simTime.toFixed(1)} 天
              </div>
            </div>

            {/* WAREHOUSE REPLENISHMENT ORBIT TRACK (THE TRAVEL ROAD) */}
            <div className="my-6 relative bg-slate-100 border border-slate-200/60 h-20 rounded-2xl flex items-center justify-between p-4 overflow-hidden">
              
              {/* Grid track pattern */}
              <div className="absolute inset-x-0 h-1.5 bg-slate-300 border-y border-slate-400/30 top-1/2 transform -translate-y-1/2 flex justify-between px-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <span key={i} className="w-1 h-full bg-white opacity-40" />
                ))}
              </div>

              {/* LEFT TERMINAL: WAREHOUSE / RESERVOIR */}
              <div className="flex flex-col items-center relative z-10 bg-slate-50 border border-slate-200 p-2 rounded-xl shadow-2xs">
                <Warehouse className="w-6 h-6 text-slate-700" />
                <span className="text-[8px] font-black text-slate-600 mt-0.5 uppercase">中央存储中心</span>
              </div>

              {/* RIGHT TERMINAL: SUPPLIER PORT */}
              <div className="flex flex-col items-center relative z-10 bg-slate-50 border border-slate-200 p-2 rounded-xl shadow-2xs">
                <Package className="w-6 h-6 text-indigo-500" />
                <span className="text-[8px] font-black text-slate-600 mt-0.5 uppercase">前置源头港口</span>
              </div>

              {/* MOVING CARGO TRUCK */}
              {truckState === "transit" && (
                <div 
                  className="absolute top-1/2 transform -translate-y-1/2 z-20 flex flex-col items-center transition-all duration-300 ease-linear"
                  style={{ 
                    right: `${12 + leadTimeProgress * 70}%` // Transit right to left
                  }}
                >
                  {/* Little speech bubble for cargo details */}
                  <div className="bg-amber-500 text-white font-black text-[8.5px] px-2 py-0.5 rounded-full shadow-md mb-1 animate-bounce flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    前置交期 L 在途: {((1 - leadTimeProgress) * (activeModel === ModelType.EOQ ? eoqParams.L : shortageParams.L)).toFixed(1)}天
                  </div>
                  <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-lg border-2 border-white animate-pulse">
                    <Truck className="w-5 h-5" />
                  </div>
                </div>
              )}

              {/* PRODUCING INDICATOR ON EPQ */}
              {truckState === "producing" && (
                <div className="absolute left-1/3 right-1/3 top-1/2 transform -translate-y-1/2 bg-teal-500/10 border border-teal-500 rounded-xl p-2 z-20 flex items-center justify-center gap-2 animate-pulse">
                  <Activity className="w-4 h-4 text-teal-600 animate-ping" />
                  <span className="text-[10px] font-black text-teal-800 uppercase">
                    持续供货生产中: {(epqProdProgress * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </div>

            {/* BOTTOM METRICS COLUMN GRID */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase block">起订触发点 (ROP)</span>
                <span className="text-sm font-black text-slate-800 mt-1 block">
                  {results.ROP ? results.ROP.toFixed(1) : "0"} <span className="text-[10px] font-normal text-slate-500">件</span>
                </span>
                <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">低于此水位将立即触发卡车采购</p>
              </div>

              <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase block">采购前置期 (L)</span>
                <span className="text-sm font-black text-slate-800 mt-1 block">
                  {activeModel === ModelType.EOQ ? eoqParams.L : activeModel === ModelType.SHORTAGE ? shortageParams.L : epqParams.L} <span className="text-[10px] font-normal text-slate-500">天</span>
                </span>
                <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">卡车从港口出发到达仓库的时间</p>
              </div>

              <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase block">最优年总订货次数</span>
                <span className="text-sm font-black text-slate-800 mt-1 block">
                  {results.N_opt ? results.N_opt.toFixed(1) : "0"} <span className="text-[10px] font-normal text-slate-500">次/年</span>
                </span>
                <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">一年内卡车发车与完成补货的频次</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------------------- */}
      {/* VIEW B: NEWSBOY SINGLE-PERIOD DAILY SALES SIMULATOR */}
      {/* -------------------------------------------------------------------------------- */}
      {activeModel === ModelType.NEWSBOY && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10 items-stretch">
            
            {/* LEFT COLUMN: SHOP VIEW AND INVENTORY STACK (4 cols) */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between relative min-h-[250px]">
              
              {/* Clock & Status */}
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <span className="text-[10px] font-extrabold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg flex items-center gap-1">
                  <Clock className="w-3 h-3 animate-spin" />
                  虚拟销售营业时间: {nbHour.toString().padStart(2, "0")}:{nbMinutes.toString().padStart(2, "0")} PM
                </span>
                <span className={`text-[9px] font-black px-1.5 rounded uppercase ${
                  nbSimState === "running" ? "bg-amber-100 text-amber-800 animate-pulse" : nbSimState === "ended" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"
                }`}>
                  {nbSimState === "running" ? "开市热卖中" : nbSimState === "ended" ? "营业结束" : "盘点准备中"}
                </span>
              </div>

              {/* SCENARIO INTERACTIVE STAGE */}
              <div className="my-4 relative bg-slate-900/5 rounded-xl border border-slate-200/50 h-36 flex items-end justify-between p-3 overflow-hidden">
                
                {/* Sky Background */}
                <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/20 to-transparent pointer-events-none" />

                {/* NEWSSTAND FRONT */}
                <div className="flex flex-col items-center z-10">
                  <div className="bg-indigo-600 text-white p-2 rounded-t-xl shadow-md border-x-2 border-t-2 border-indigo-700 flex items-center gap-1">
                    <ShoppingBag className="w-5 h-5" />
                    <span className="text-[8.5px] font-black uppercase">报童商铺</span>
                  </div>
                  <div className="bg-amber-700 w-24 h-4 shadow-sm text-center">
                    <span className="text-[7.5px] font-black text-white uppercase block">特惠供应站</span>
                  </div>
                </div>

                {/* INVENTORY STACK (Visualizing remaining stock Q) */}
                <div className="flex flex-col items-center justify-end h-full z-10">
                  <span className="text-[8px] font-bold text-slate-400 mb-1 uppercase">剩余库存 Q</span>
                  {nbInventory > 0 ? (
                    <div className="flex flex-col-reverse gap-0.5 max-h-[80px] overflow-hidden pr-2">
                      {Array.from({ length: Math.min(10, Math.ceil(nbInventory / 10)) }).map((_, idx) => (
                        <div 
                          key={idx} 
                          className="w-14 h-2 bg-indigo-500 rounded-sm border-b border-indigo-700 shadow-2xs flex items-center justify-center"
                          style={{ opacity: 1 - idx * 0.08 }}
                        >
                          <span className="text-[5.5px] font-bold text-white leading-none">
                            {idx === 0 ? `~${nbInventory}件` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-rose-50 border border-rose-200 px-2 py-1 rounded-md text-center flex flex-col items-center animate-bounce">
                      <Frown className="w-4 h-4 text-rose-500" />
                      <span className="text-[8px] text-rose-600 font-extrabold">库存告罄!</span>
                    </div>
                  )}
                </div>

                {/* CLIENT CHARACTER VISUALIZER */}
                {nbCurrentCustomer && (
                  <div className="absolute left-1/2 transform -translate-x-1/2 bottom-3 z-20 flex flex-col items-center animate-bounce">
                    <div className={`p-2 rounded-2xl shadow-lg border-2 flex items-center gap-1 ${
                      nbCurrentCustomer.outcome === "success" 
                        ? "bg-emerald-500 border-white text-white" 
                        : nbCurrentCustomer.outcome === "partial"
                        ? "bg-amber-500 border-white text-white"
                        : "bg-rose-500 border-white text-white"
                    }`}>
                      {nbCurrentCustomer.outcome === "success" ? (
                        <Smile className="w-4.5 h-4.5 shrink-0" />
                      ) : (
                        <Frown className="w-4.5 h-4.5 shrink-0" />
                      )}
                      <div className="text-[9.5px] font-black flex flex-col">
                        <span>
                          {nbCurrentCustomer.outcome === "success" 
                            ? `买到 ${nbCurrentCustomer.purchasedQty}件!` 
                            : nbCurrentCustomer.outcome === "partial"
                            ? `只抢到 ${nbCurrentCustomer.purchasedQty}件!`
                            : "脱销断货了!"}
                        </span>
                        <span className="text-[7.5px] font-normal opacity-90">
                          需求: {nbCurrentCustomer.demandQty}件
                        </span>
                      </div>
                    </div>
                    <User className="w-6 h-6 text-slate-700 mt-1" />
                  </div>
                )}
              </div>

              {/* Quick Metrics */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-slate-50 border border-slate-100 p-2 rounded-lg">
                  <span className="text-[8.5px] text-slate-400 font-bold block uppercase">初期订购 Q</span>
                  <span className="font-black text-slate-800 font-mono">{nbQOrdered} 件</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-2 rounded-lg">
                  <span className="text-[8.5px] text-slate-400 font-bold block uppercase">今日实际需求</span>
                  <span className="font-black text-indigo-600 font-mono">{nbTotalDemand || "0"} 件</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-2 rounded-lg">
                  <span className="text-[8.5px] text-slate-400 font-bold block uppercase">累计销售</span>
                  <span className="font-black text-emerald-600 font-mono">{nbSales} 件</span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: SIMULATION LOGS AND FINANCIAL LEDGER (7 cols) */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between relative min-h-[250px]">
              
              {/* Realtime Arrivals Logs */}
              <div>
                <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-wide border-b border-slate-100 pb-1.5 mb-2">
                  顾客到店流水日志 (Stochastic Arrivals Feed)
                </h5>
                
                {nbCustomers.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-slate-50">
                    <p className="text-xs text-slate-400">暂无到店记录。点击右上角按钮开始单日仿真。</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[110px] overflow-y-auto pr-1">
                    {nbCustomers.map((cust) => (
                      <div 
                        key={cust.id} 
                        className={`flex items-center justify-between p-2 rounded-lg border text-xs ${
                          cust.outcome === "success" 
                            ? "bg-emerald-50/50 border-emerald-100 text-emerald-950" 
                            : cust.outcome === "partial"
                            ? "bg-amber-50/50 border-amber-100 text-amber-950"
                            : "bg-rose-50/50 border-rose-100 text-rose-950"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-slate-400 font-bold">{cust.time}</span>
                          <span className="font-bold">顾客 #{cust.id} 到店</span>
                        </div>
                        <div className="text-[11px] font-semibold flex items-center gap-2">
                          <span>购买需求: {cust.demandQty}件</span>
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-black ${
                            cust.outcome === "success" 
                              ? "bg-emerald-200 text-emerald-800" 
                              : cust.outcome === "partial"
                              ? "bg-amber-200 text-amber-800"
                              : "bg-rose-200 text-rose-800"
                          }`}>
                            {cust.outcome === "success" ? `购得 ${cust.purchasedQty}件` : cust.outcome === "partial" ? `抢得 ${cust.purchasedQty}件` : "脱销空手回"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* LEDGER - FINANCIAL REPORT AT THE END OF DAY */}
              {nbSimState === "ended" && (
                <div className="mt-4 pt-3 border-t border-indigo-100 bg-indigo-50/30 rounded-xl p-3 border border-indigo-100/50">
                  <h6 className="text-[10.5px] font-extrabold text-indigo-900 uppercase flex items-center gap-1 mb-2">
                    <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
                    今日期末经营决算 ledger (Scenario Financials)
                  </h6>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[9px] text-slate-400 font-semibold block">1. 营业收入 (Revenue)</span>
                      <span className="font-extrabold text-slate-700 font-mono block">¥{nbRevenue}</span>
                      <span className="text-[8.5px] text-slate-400">({nbSales}件 × ¥{nbPrice})</span>
                    </div>

                    <div>
                      <span className="text-[9px] text-slate-400 font-semibold block">2. 进货总成本 (Cost)</span>
                      <span className="font-extrabold text-slate-700 font-mono block">¥{nbPurchasingCost}</span>
                      <span className="text-[8.5px] text-slate-400">({nbQOrdered}件 × ¥{nbCost})</span>
                    </div>

                    <div>
                      <span className="text-[9px] text-slate-400 font-semibold block">3. 期末残值回收 (Salvage)</span>
                      <span className="font-extrabold text-emerald-600 font-mono block">+¥{nbScrapSalvage}</span>
                      <span className="text-[8.5px] text-slate-400">({nbInventory}件 × ¥{nbScrap})</span>
                    </div>

                    <div className="border-l border-indigo-100 pl-3">
                      <span className="text-[9px] text-slate-500 font-extrabold block">4. 脱销损失 (Underage Loss)</span>
                      <span className="font-extrabold text-rose-600 font-mono block">-¥{nbShortageLoss}</span>
                      <span className="text-[8.5px] text-slate-400">({nbShortage}件 × ¥{newsboyParams.Cu})</span>
                    </div>
                  </div>

                  {/* Final net profit statement */}
                  <div className="mt-3 pt-2.5 border-t border-indigo-100/60 flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-extrabold text-indigo-950">
                        期末净得利润 (Net Profit with Residuals):
                      </span>
                      <span className="text-xs text-slate-500">
                        公式: 营收 - 进货 + 残值
                      </span>
                    </div>
                    <span className={`text-sm font-black font-mono px-2.5 py-0.5 rounded-lg border ${
                      (nbRevenue - nbPurchasingCost + nbScrapSalvage) >= 0 
                        ? "bg-emerald-500 border-emerald-600 text-white" 
                        : "bg-rose-500 border-rose-600 text-white"
                    }`}>
                      ¥{nbRevenue - nbPurchasingCost + nbScrapSalvage}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* MONTE CARLO RAINDROP HISTOGRAM SIMULATION CHART */}
          <MonteCarloRaindropChart
            newsboyParams={newsboyParams}
            results={results}
          />
        </>
      )}

    </div>
  );
}
