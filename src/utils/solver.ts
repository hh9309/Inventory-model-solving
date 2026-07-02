import { ModelType, EOQParams, ShortageParams, EPQParams, NewsboyParams, CalculationResults } from "../types";

/**
 * Standard Normal Probability Density Function (PDF)
 */
export function normalPDF(x: number, mean: number = 0, stdDev: number = 1): number {
  const z = (x - mean) / stdDev;
  return (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);
}

/**
 * Standard Normal Cumulative Distribution Function (CDF)
 * Highly accurate rational approximation
 */
export function normalCDF(x: number, mean: number = 0, stdDev: number = 1): number {
  const z = (x - mean) / stdDev;
  const absZ = Math.abs(z);
  const t = 1 / (1 + 0.2316419 * absZ);
  const d = 0.3989422804; // 1/sqrt(2pi)
  const p = d * Math.exp(-0.5 * absZ * absZ) * (
    0.319381530 * t +
    -0.356563782 * Math.pow(t, 2) +
    1.781477937 * Math.pow(t, 3) +
    -1.821255978 * Math.pow(t, 4) +
    1.330274429 * Math.pow(t, 5)
  );
  const cdfValue = z >= 0 ? 1 - p : p;
  // Guard values
  return Math.max(0, Math.min(1, cdfValue));
}

/**
 * Inverse Standard Normal Cumulative Distribution Function (Probit)
 * Beasley-Springer-Moro / rational approximation
 */
export function inverseNormalCDF(p: number): number {
  if (p <= 0) return -5.0;
  if (p >= 1) return 5.0;
  
  const a = [
    -3.969683028665376e+01,  2.209460984245205e+02,
    -2.759285104469687e+02,  1.383577518672690e+02,
    -3.066479804361620e+01,  2.506628277459239e+00
  ];
  const b = [
    -5.447609879822406e+01,  1.615858368580409e+02,
    -1.556989798598866e+02,  6.680131188771972e+01,
    -1.328068155288572e+01
  ];
  const c = [
    -7.784894002430293e-03, -3.223964580411365e-01,
    -2.400758277161838e+00, -2.549732539343734e+00,
     4.374664141464968e+00,  2.938163982698783e+00
  ];
  const d = [
     7.784695709041462e-03,  3.224671290700341e-01,
     2.445134137142446e+00,  3.754408661907416e+00
  ];

  const p_low = 0.02425;
  const p_high = 1 - p_low;

  if (p < p_low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p > p_high) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else {
    const q = p - 0.5;
    const r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
           (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
}

/**
 * Solve EOQ Model
 */
export function solveEOQ(params: EOQParams): CalculationResults {
  const { D, C1, C3, L } = params;
  
  if (D <= 0 || C1 <= 0 || C3 <= 0) {
    return { Q_opt: 0, totalCost: 0 };
  }

  const Q_opt = Math.sqrt((2 * D * C3) / C1);
  const setupCost = (D / Q_opt) * C3;
  const holdingCost = (Q_opt / 2) * C1;
  const totalCost = setupCost + holdingCost;
  const N_opt = D / Q_opt;
  const t_opt = Q_opt / D; // 年

  // 重新订货点
  const dailyDemand = D / 365;
  const ROP = dailyDemand * L;

  return {
    Q_opt,
    totalCost,
    holdingCost,
    setupCost,
    I_max: Q_opt,
    N_opt,
    t_opt,
    ROP
  };
}

/**
 * Solve Planned Shortages Model (允许缺货)
 */
export function solveShortage(params: ShortageParams): CalculationResults {
  const { D, C1, C3, C4, L } = params;

  if (D <= 0 || C1 <= 0 || C3 <= 0 || C4 <= 0) {
    return { Q_opt: 0, totalCost: 0 };
  }

  const correctionFactor = (C1 + C4) / C4;
  const Q_opt = Math.sqrt(((2 * D * C3) / C1) * correctionFactor);
  
  const S_opt = Q_opt * (C1 / (C1 + C4));
  const I_max = Q_opt - S_opt;

  const setupCost = (D / Q_opt) * C3;
  const holdingCost = (Math.pow(I_max, 2) * C1) / (2 * Q_opt);
  const shortageCost = (Math.pow(S_opt, 2) * C4) / (2 * Q_opt);
  const totalCost = setupCost + holdingCost + shortageCost;
  
  const N_opt = D / Q_opt;
  const t_opt = Q_opt / D;

  // 重新订货点
  const dailyDemand = D / 365;
  const ROP = (dailyDemand * L) - S_opt;

  return {
    Q_opt,
    totalCost,
    holdingCost,
    setupCost,
    shortageCost,
    I_max,
    S_opt,
    N_opt,
    t_opt,
    ROP
  };
}

/**
 * Solve EPQ Model (连续生产模型)
 */
export function solveEPQ(params: EPQParams): CalculationResults {
  const { D, C1, C3, P, L } = params;

  if (D <= 0 || C1 <= 0 || C3 <= 0 || P <= D) {
    return { Q_opt: 0, totalCost: 0 };
  }

  const rateFactor = 1 - (D / P);
  const Q_opt = Math.sqrt((2 * D * C3) / (C1 * rateFactor));
  const I_max = Q_opt * rateFactor;

  const setupCost = (D / Q_opt) * C3;
  const holdingCost = (I_max / 2) * C1;
  const totalCost = setupCost + holdingCost;
  
  const N_opt = D / Q_opt;
  const t_opt = Q_opt / D;

  // 重新订货点
  const dailyDemand = D / 365;
  const ROP = dailyDemand * L;

  return {
    Q_opt,
    totalCost,
    holdingCost,
    setupCost,
    I_max,
    N_opt,
    t_opt,
    ROP
  };
}

/**
 * Solve Newsboy Model (报童模型)
 */
export function solveNewsboy(params: NewsboyParams): CalculationResults {
  const { mean, stdDev, minDemand, maxDemand, distribution, Cu, Co } = params;

  if (Cu <= 0 || Co <= 0) {
    return { Q_opt: 0, totalCost: 0, criticalRatio: 0 };
  }

  // 1. 临界比例 (Critical Ratio)
  const criticalRatio = Cu / (Cu + Co);
  let Q_opt = 0;
  let expectedSales = 0;
  let expectedLeftover = 0;
  let expectedShortage = 0;

  if (distribution === "uniform") {
    const a = minDemand;
    const b = maxDemand;
    
    // 最优订货批量
    Q_opt = a + criticalRatio * (b - a);

    // 期望销量 Expected Sales
    // ES = \int_a^Q x f(x) dx + Q \int_Q^b f(x) dx
    // ES = (Q^2 - a^2)/(2(b-a)) + Q * (b - Q)/(b-a)
    expectedSales = ((Q_opt * Q_opt - a * a) / (2 * (b - a))) + (Q_opt * (b - Q_opt) / (b - a));
    
    // 期望滞销量 Expected Leftover (过剩)
    // E[Leftover] = \int_a^Q (Q - x) f(x) dx = (Q-a)^2 / (2(b-a))
    expectedLeftover = Math.pow(Q_opt - a, 2) / (2 * (b - a));

    // 期望缺货量 Expected Shortage
    // E[Shortage] = \int_Q^b (x - Q) f(x) dx = (b-Q)^2 / (2(b-a))
    expectedShortage = Math.pow(b - Q_opt, 2) / (2 * (b - a));

  } else {
    // 正态分布
    const mu = mean;
    const sigma = stdDev;
    
    // 最优订货批量
    const z = inverseNormalCDF(criticalRatio);
    Q_opt = mu + z * sigma;

    // 用 z 分布的单位损失函数 L(z) = \phi(z) - z(1 - \Phi(z))
    const phi_z = normalPDF(z, 0, 1);
    const Phi_z = criticalRatio; // standard normal CDF at z is exactly critical ratio

    // Expected Leftover
    // E[Leftover] = \int_{-inf}^Q (Q - x) f(x) dx = (Q-mu)*Phi(z) + sigma * phi(z)
    expectedLeftover = (Q_opt - mu) * Phi_z + sigma * phi_z;

    // Expected Shortage
    // E[Shortage] = \int_Q^{inf} (x - Q) f(x) dx = (mu-Q)*(1-Phi(z)) + sigma * phi(z)
    expectedShortage = (mu - Q_opt) * (1 - Phi_z) + sigma * phi_z;

    // Expected Sales = Q - Expected Leftover
    expectedSales = Q_opt - expectedLeftover;
  }

  // 最小期望滞销+缺货总成本
  const totalCost = Co * expectedLeftover + Cu * expectedShortage;

  return {
    Q_opt,
    totalCost,
    criticalRatio,
    expectedSales,
    expectedLeftover,
    expectedShortage
  };
}

/**
 * Universal dispatcher
 */
export function solveInventoryModel(modelType: ModelType, params: any): CalculationResults {
  switch (modelType) {
    case ModelType.EOQ:
      return solveEOQ(params as EOQParams);
    case ModelType.SHORTAGE:
      return solveShortage(params as ShortageParams);
    case ModelType.EPQ:
      return solveEPQ(params as EPQParams);
    case ModelType.NEWSBOY:
      return solveNewsboy(params as NewsboyParams);
    default:
      return { Q_opt: 0, totalCost: 0 };
  }
}

/**
 * Perform a 1D Sensitivity Analysis on a parameter
 * Generates an array of points for plotting total cost vs parameter variation
 */
export function calculateSensitivity(
  modelType: ModelType,
  baseParams: any,
  varyingParam: string,
  minFactor: number = 0.5,
  maxFactor: number = 1.5,
  steps: number = 10
): Array<{ value: number; percentChange: number; totalCost: number; Q_opt: number }> {
  const points = [];
  const baseValue = baseParams[varyingParam];
  
  if (baseValue === undefined || baseValue <= 0) return [];

  // Calculate base results to compute percent change
  const baseResults = solveInventoryModel(modelType, baseParams);
  const baseTC = baseResults.totalCost;

  for (let i = 0; i <= steps; i++) {
    const factor = minFactor + (i / steps) * (maxFactor - minFactor);
    const testValue = baseValue * factor;
    
    // Copy and update param
    const testParams = { ...baseParams, [varyingParam]: testValue };
    
    // For EPQ, enforce P > D constraint
    if (modelType === ModelType.EPQ && varyingParam === 'D' && testValue >= testParams.P) {
      continue;
    }
    if (modelType === ModelType.EPQ && varyingParam === 'P' && testValue <= testParams.D) {
      continue;
    }

    const testResults = solveInventoryModel(modelType, testParams);
    
    points.push({
      value: Number(testValue.toFixed(2)),
      percentChange: Number(((factor - 1) * 100).toFixed(0)),
      totalCost: Number(testResults.totalCost.toFixed(2)),
      Q_opt: Number(testResults.Q_opt.toFixed(2))
    });
  }

  return points;
}
