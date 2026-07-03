export enum ModelType {
  EOQ = "EOQ",                 // 经典经济订货批量模型
  SHORTAGE = "SHORTAGE",       // 允许缺货延迟交货模型
  EPQ = "EPQ",                 // 经济生产批量模型
  NEWSBOY = "NEWSBOY",          // 报童模型 (随机单周期)
  THRESHOLD = "THRESHOLD"      // 连续随机 (s, Q) 阀值控制模型
}

export interface EOQParams {
  D: number;   // 年需求量 (Units/Year)
  C1: number;  // 单位年存储费 (Cost/Unit/Year)
  C3: number;  // 单次订货费 (Cost/Order)
  L: number;   // 前置时间 (Days)
}

export interface ShortageParams extends EOQParams {
  C4: number;  // 单位年缺货损失费 (Cost/Unit/Year)
}

export interface EPQParams extends EOQParams {
  P: number;   // 年生产率 (Units/Year)
}

export interface NewsboyParams {
  mean: number;       // 需求均值
  stdDev: number;     // 需求标准差
  minDemand: number;  // 均匀分布下限
  maxDemand: number;  // 均匀分布上限
  distribution: "normal" | "uniform"; // 需求分布类型
  Cu: number;         // 缺货损失 (Underage Cost - 单位未满足需求损失)
  Co: number;         // 过剩损失 (Overage Cost - 单位滞销产品损失)
}

export interface ThresholdParams extends EOQParams {
  sigmaDaily: number;   // 日需求量标准差 (Units/Day)
  serviceLevel: number; // 期望服务水平 (0.8 ~ 0.999)
}

export interface CalculationResults {
  Q_opt: number;            // 最优订货批量/生批量
  totalCost: number;        // 最小总成本
  holdingCost?: number;     // 总持有成本
  setupCost?: number;       // 总订货费/起订费
  shortageCost?: number;    // 总缺货成本
  I_max?: number;           // 最大库存水平
  S_opt?: number;           // 允许最大缺货量
  t_opt?: number;           // 订货周期(年)
  N_opt?: number;           // 年订货次数
  ROP?: number;             // 重新订货点
  // 报童模型与阀值模型专属
  criticalRatio?: number;   // 临界比率 / 服务水平 (Service Level)
  expectedLeftover?: number;// 期望过剩(滞销)量 / 提前期需求均值
  expectedShortage?: number;// 期望缺货量 / 提前期需求标准差
  expectedSales?: number;   // 期望销量 / 安全库存
  // (s, Q) 阀值模型专属
  safetyStock?: number;          // 安全库存 (Safety Stock)
  leadTimeDemandMean?: number;   // 提前期需求均值 (μ_L)
  leadTimeDemandStdDev?: number; // 提前期需求标准差 (σ_L)
  zScore?: number;               // 安全系数 (z)
}

export interface AIInsightResponse {
  error?: boolean;
  message?: string;
  evaluation: string;
  risks: string[];
  suggestions: string[];
  sensitivityAnalysis: string;
  isCustomAnswer?: boolean;
  customAnswer?: string;
}

export interface SavedScenario {
  id: string;
  name: string;
  modelType: ModelType;
  params: any;
  timestamp: string;
}
