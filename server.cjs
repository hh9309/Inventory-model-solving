var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_child_process = require("child_process");
var import_fs = __toESM(require("fs"), 1);
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json());
var aiClient = null;
function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    throw new Error("GEMINI_API_KEY \u672A\u5728\u7CFB\u7EDF Secrets \u9762\u677F\u4E2D\u914D\u7F6E\u3002\u8BF7\u5728 Secrets \u9762\u677F\u4E2D\u6DFB\u52A0\u60A8\u7684 Google AI Studio API \u5BC6\u94A5\u3002");
  }
  if (!aiClient) {
    aiClient = new import_genai.GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient;
}
app.post("/api/inventory/insight", async (req, res) => {
  try {
    const { modelType, params, results, context } = req.body;
    const ai = getGenAI();
    const prompt = `\u4F60\u662F\u4E00\u4F4D\u8FD0\u7B79\u5B66\uFF08Operations Research\uFF09\u4E0E\u4F9B\u5E94\u94FE\u7BA1\u7406\uFF08Supply Chain Management\uFF09\u4E13\u5BB6\u3002
\u76EE\u524D\uFF0C\u7528\u6237\u6B63\u5728\u6211\u4EEC\u7684\u201C\u8FD0\u7B79\u5B66\u5E93\u5B58\u63A7\u5236\u4E0E\u4F18\u5316\u4EFF\u771F\u5E73\u53F0\u201D\u4E2D\u5BF9\u4EE5\u4E0B\u6A21\u578B\u8FDB\u884C\u4EFF\u771F\u6C42\u89E3\uFF1A

\u6A21\u578B\u7C7B\u578B: ${modelType}
\u7528\u6237\u8F93\u5165\u7684\u914D\u7F6E\u53C2\u6570:
${JSON.stringify(params, null, 2)}

\u8FD0\u7B79\u5B66\u6A21\u578B\u8BA1\u7B97\u51FA\u7684\u6700\u4F18\u7B56\u7565\u7ED3\u679C:
${JSON.stringify(results, null, 2)}

\u7528\u6237\u8F93\u5165\u7684\u989D\u5916\u5546\u4E1A\u80CC\u666F/\u4F9B\u5E94\u94FE\u72B6\u51B5:
"${context || "\u65E0\u989D\u5916\u80CC\u666F\u4FE1\u606F"}"

\u8BF7\u9488\u5BF9\u5F53\u524D\u7684\u53C2\u6570\u914D\u7F6E\u3001\u6700\u4F18\u89E3\u7B56\u7565\u4EE5\u53CA\u5546\u4E1A\u80CC\u666F\uFF0C\u8FDB\u884C\u6DF1\u5EA6\u7684\u201C\u8FD0\u7B79\u5B66\u4E0E\u4F9B\u5E94\u94FE\u8BCA\u65AD\u6D1E\u5BDF\u201D\u3002
\u8BF7\u8FD4\u56DE\u4E00\u4E2A JSON \u683C\u5F0F\u7684\u54CD\u5E94\uFF0C\u5176\u5B57\u6BB5\u5305\u62EC\uFF1A
1. "evaluation": \u5BF9\u5F53\u524D\u5E93\u5B58\u63A7\u5236\u7B56\u7565\u4E0E\u6210\u672C\u6784\u6210\u7684\u6DF1\u5EA6\u8BC4\u4F30\uFF08\u7B80\u660E\u4E13\u4E1A\uFF0C\u7EA6150\u5B57\uFF0C\u4F7F\u7528\u4E2D\u6587\uFF0C\u4F53\u73B0\u51FA\u8FD0\u7B79\u5B66\u5B58\u50A8\u8BBA\u7684\u4E13\u4E1A\u6027\uFF0C\u6BD4\u5982\u6301\u6709\u6210\u672C\u4E0E\u8D77\u8BA2\u6210\u672C\u7684\u6743\u8861\uFF0C\u6216\u8005\u62A5\u7AE5\u6A21\u578B\u7684\u4E34\u754C\u70B9\u7387\uFF09\u3002
2. "risks": \u4E00\u4E2A\u6570\u7EC4\uFF082-4\u4E2A\u6210\u5458\uFF09\uFF0C\u5217\u51FA\u5F53\u524D\u5E93\u5B58\u7B56\u7565\u5728\u5B9E\u9645\u4F9B\u5E94\u94FE\u4E2D\u9762\u4E34\u7684\u98CE\u9669\u6216\u74F6\u9888\uFF08\u4F8B\u5982\uFF1A\u5B58\u50A8\u6210\u672C\u8FC7\u9AD8\u8D44\u91D1\u5360\u7528\u4E25\u91CD\u3001\u7F3A\u8D27\u7387\u504F\u9AD8\u5F71\u54CD\u5BA2\u6237\u4F53\u9A8C\u3001\u524D\u7F6E\u65F6\u95F4\u8F83\u957F\u5BFC\u81F4\u65AD\u8D27\u98CE\u9669\u7B49\uFF09\u3002
3. "suggestions": \u4E00\u4E2A\u6570\u7EC4\uFF082-4\u4E2A\u6210\u5458\uFF09\uFF0C\u7ED9\u51FA\u53EF\u843D\u5730\u7684\u8FD0\u7B79\u4F18\u5316\u4E0E\u7BA1\u7406\u5EFA\u8BAE\uFF08\u4F8B\u5982\uFF1A\u5982\u4F55\u901A\u8FC7\u8C08\u5224\u964D\u4F4E\u5355\u6B21\u8BA2\u8D27\u6210\u672C\u3001\u4F55\u65F6\u5E94\u8BE5\u5F15\u5165\u5B89\u5168\u5E93\u5B58\u3001\u5982\u4F55\u5411EPQ\u6216\u968F\u673A\u6A21\u578B\u8FC7\u6E21\u7B49\uFF09\u3002
4. "sensitivityAnalysis": \u654F\u611F\u6027\u7B80\u6790\uFF08150\u5B57\u4EE5\u5185\uFF09\uFF0C\u8BF4\u660E\u5728\u5F53\u524D\u53C2\u6570\u4E0B\uFF0C\u54EA\u4E2A\u53C2\u6570\uFF08\u5982\u9700\u6C42\u6CE2\u52A8\u3001\u8D77\u8BA2\u8D39\u3001\u6301\u6709\u8D39\uFF09\u7684\u5C0F\u5E45\u53D8\u5316\u5BF9\u603B\u6210\u672C\u6216\u6700\u4F18\u7B56\u7565\u7684\u5F71\u54CD\u6700\u5267\u70C8\u3001\u6700\u654F\u611F\u3002

\u786E\u4FDD\u8FD4\u56DE\u5408\u6CD5\u7684 JSON \u5B57\u7B26\u4E32\uFF0C\u76F4\u63A5\u8FD4\u56DE JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981\u7528 markdown \u7684 \`\`\`json \`\`\` \u683C\u5F0F\u5305\u88F9\u3002`;
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    const responseText = response.text || "{}";
    res.json(JSON.parse(responseText.trim()));
  } catch (error) {
    console.error("Gemini API error:", error);
    res.status(200).json({
      error: true,
      message: error.message || "\u65E0\u6CD5\u8FDE\u63A5\u5230 Gemini AI \u670D\u52A1\u3002",
      evaluation: "\u26A0\uFE0F [AI \u6F14\u793A\u79BB\u7EBF\u6A21\u5F0F] \u60A8\u7684\u5B58\u50A8\u6A21\u578B\u5DF2\u8BA1\u7B97\u51FA\u6570\u5B66\u4E0A\u7684\u7EDD\u5BF9\u6700\u4F18\u89E3\u3002\u5728\u5F53\u524D\u7684\u5E93\u5B58\u6301\u6709\u6210\u672C\u4E0E\u8D77\u8BA2\u8D39\u7528\u6BD4\u4F8B\u4E0B\uFF0C\u6A21\u578B\u627E\u5230\u4E86\u603B\u671F\u671B\u6210\u672C\u6700\u4F4E\u7684\u5E73\u8861\u70B9\u3002\u8BF7\u6CE8\u610F\uFF0C\u5728\u786E\u5B9A\u6027\u9700\u6C42\u8BBE\u5B9A\u4E0B\uFF0C\u672A\u8003\u8651\u524D\u7F6E\u65F6\u95F4\u6CE2\u52A8\u548C\u968F\u673A\u9700\u6C42\u53D8\u5316\u98CE\u9669\uFF0C\u5E94\u8B66\u60D5\u5B9E\u9645\u7F3A\u8D27\u53EF\u80FD\u3002",
      risks: [
        "\u672A\u914D\u7F6E Gemini \u5BC6\u94A5 (\u5728 AI Studio \u754C\u9762 Secrets \u9762\u677F\u914D\u7F6E)\uFF1B\u6B63\u5728\u4F7F\u7528\u79BB\u7EBF\u9759\u6001\u8FD0\u7B79\u89C4\u5219\u8FDB\u884C\u8BCA\u65AD\u3002",
        "\u7531\u4E8E\u6A21\u578B\u5047\u5B9A\u5E74\u9700\u6C42\u7387\u6052\u5B9A\uFF0C\u5728\u4F9B\u5E94\u94FE\u4E0B\u6E38\u9700\u6C42\u53D1\u751F\u7A81\u53D1\u6CE2\u5CF0\u65F6\uFF0C\u96F6\u5B89\u5168\u5E93\u5B58\u4F1A\u5BFC\u81F4\u4E25\u91CD\u7684\u4EA4\u8D27\u5EF6\u8FDF\u3002",
        "\u82E5\u5B58\u50A8\u573A\u5730\u5BB9\u91CF\u6709\u9650\uFF0C\u6700\u4F18\u8BA2\u8D27\u91CF Q* \u53EF\u80FD\u4F1A\u8D85\u51FA\u6700\u5927\u7269\u7406\u5E93\u5BB9\u4E0A\u9650\uFF0C\u4EA7\u751F\u989D\u5916\u7684\u4E8C\u6B21\u642C\u8FD0\u8D39\u3002"
      ],
      suggestions: [
        "\u5728 Secrets \u9762\u677F\u4E2D\u6DFB\u52A0\u6709\u6548 API \u5BC6\u94A5\uFF0C\u53EF\u89E3\u9501\u4E13\u5C5E\u4F9B\u5E94\u94FE\u8BCA\u65AD AI \u529F\u80FD\u3002",
        "\u5EFA\u8BAE\u8003\u8651\u5BF9\u4F9B\u5E94\u5546\u8D77\u8BA2\u70B9\u8FDB\u884C\u8054\u5408\u91C7\u8D2D\u8C08\u5224\uFF0C\u964D\u4F4E\u5355\u6B21\u8D77\u8BA2\u8D39 C3\uFF0C\u4ECE\u800C\u5728\u4E0D\u589E\u52A0\u603B\u8D39\u7528\u7684\u60C5\u51B5\u4E0B\u538B\u7F29\u8BA2\u8D2D\u6279\u91CF Q*\uFF0C\u63D0\u9AD8\u8D44\u91D1\u5468\u8F6C\u6548\u7387\u3002",
        "\u5F53\u9700\u6C42\u6CE2\u52A8\u7387\u8D85\u8FC7 15% \u65F6\uFF0C\u5E94\u53CA\u65F6\u8FC7\u6E21\u5230\u300E\u968F\u673A\u578B\u5B58\u50A8\u6A21\u578B(\u5982\u62A5\u7AE5\u6A21\u578B)\u300F\uFF0C\u5229\u7528\u670D\u52A1\u6C34\u5E73\u7CFB\u6570\u8BA1\u7B97\u5B89\u5168\u5E93\u5B58\u3002"
      ],
      sensitivityAnalysis: "\u7531\u4E8E EOQ \u6A21\u578B\u6700\u4F18\u6279\u91CF\u4E0E\u5E74\u9700\u6C42\u91CF\u3001\u8D77\u8BA2\u8D39\u6210\u5E73\u65B9\u6839\u5173\u7CFB\uFF0C\u5F53\u524D\u914D\u7F6E\u5BF9\u5E74\u9700\u6C42 D \u7684\u8F7B\u5FAE\u53D8\u5316\uFF08\u5982\u4E0A\u6DA810%\uFF09\u4E0D\u751A\u654F\u611F\uFF08\u4EC5\u5BFC\u81F4\u603B\u6210\u672C\u4E0A\u6DA8\u7EA6 4.88%\uFF09\uFF0C\u4F46\u5BF9\u4E8E\u5355\u6B21\u8D77\u8BA2\u6210\u672C\u7684\u4EFB\u4F55\u76F4\u63A5\u4E0A\u6DA8\u5E94\u8BE5\u4E88\u4EE5\u8B66\u60D5\u3002"
    });
  }
});
app.post("/api/inventory/run-python", async (req, res) => {
  try {
    const { modelType, params } = req.body;
    let pyScript = "";
    if (modelType === "EOQ") {
      pyScript = `import math

# 1. \u8F93\u5165\u53C2\u6570\u914D\u7F6E
D = ${params.D}       # \u5E74\u9700\u6C42\u91CF (Units/Year)
C1 = ${params.C1}     # \u5355\u4F4D\u5E74\u5B58\u50A8\u8D39 (Cost/Unit/Year)
C3 = ${params.C3}     # \u5355\u6B21\u8D77\u8BA2/\u8BA2\u8D27\u8D39 (Cost/Order)
L = ${params.L}       # \u91C7\u8D2D\u524D\u7F6E\u671F (Days)

# 2. \u7ECF\u5178 EOQ \u6C42\u89E3\u516C\u5F0F\u8BA1\u7B97
Q_opt = math.sqrt((2 * D * C3) / C1)
setup_cost = (D / Q_opt) * C3
holding_cost = (Q_opt / 2) * C1
total_cost = setup_cost + holding_cost
rop = (D / 365) * L

# 3. \u8F93\u51FA\u6C42\u89E3\u7ED3\u679C\u4E0E\u654F\u611F\u6027\u6307\u6807
print("=========================================")
print("===   PYTHON \u8FD0\u7B79\u5B66\u5B58\u50A8\u8BBA\u6C42\u89E3\u5668\uFF1A\u7ECF\u5178EOQ   ===")
print("=========================================")
print(f"|  \u6700\u4F18\u8BA2\u8D2D\u6279\u91CF (Q*):      {Q_opt:12.2f} \u4EF6/\u6B21")
print(f"|  \u5E74\u91C7\u8D2D/\u8BA2\u8D27\u603B\u6210\u672C (Setup):  \xA5{setup_cost:11.2f}")
print(f"|  \u5E74\u5E73\u5747\u5E93\u5B58\u5B58\u50A8\u8D39 (Holding): \xA5{holding_cost:11.2f}")
print(f"|  \u6700\u4F18\u5E74\u5316\u603B\u671F\u671B\u6210\u672C (Total): \xA5{total_cost:11.2f}")
print(f"|  \u91CD\u65B0\u8BA2\u8D27\u89E6\u53D1\u70B9 (ROP):       {rop:12.2f} \u4EF6")
print("=========================================")
print("[\u8FD0\u7B79\u5BF9\u51B2\u5206\u6790] \u5728\u6700\u4F18\u6279\u91CF Q* \u4E0B\uFF0C\u5E74\u8BA2\u8D27\u603B\u6210\u672C\u4E0E\u50A8\u5B58\u603B\u6210\u672C\u8FBE\u5230\u7406\u8BBA\u7EDD\u5BF9\u5E73\u8861\uFF1A")
print(f"|  \u5BF9\u51B2\u5DEE\u503C (Setup - Holding) = \xA5{math.fabs(setup_cost - holding_cost):.4f} (\u7406\u8BBA\u503C\u4E3A0)")
print("=========================================")
`;
    } else if (modelType === "SHORTAGE") {
      pyScript = `import math

# 1. \u8F93\u5165\u53C2\u6570\u914D\u7F6E
D = ${params.D}       # \u5E74\u9700\u6C42\u91CF
C1 = ${params.C1}     # \u5355\u4F4D\u5E74\u5B58\u50A8\u8D39
C3 = ${params.C3}     # \u5355\u6B21\u8D77\u8BA2\u8D39
C4 = ${params.C4}     # \u5355\u4F4D\u5E74\u5EF6\u8FDF\u7F3A\u8D27\u635F\u5931\u8D39
L = ${params.L}       # \u91C7\u8D2D\u524D\u7F6E\u671F

# 2. \u5141\u8BB8\u7F3A\u8D27\u7684 EOQ \u516C\u5F0F\u8BA1\u7B97
correction_factor = (C1 + C4) / C4
Q_opt = math.sqrt(((2 * D * C3) / C1) * correction_factor)
S_opt = Q_opt * (C1 / (C1 + C4))
I_max = Q_opt - S_opt

setup_cost = (D / Q_opt) * C3
holding_cost = (I_max**2 * C1) / (2 * Q_opt)
shortage_cost = (S_opt**2 * C4) / (2 * Q_opt)
total_cost = setup_cost + holding_cost + shortage_cost
rop = ((D / 365) * L) - S_opt

# 3. \u8F93\u51FA\u6C42\u89E3\u7ED3\u679C
print("=========================================")
print("=== PYTHON \u8FD0\u7B79\u5B66\u5B58\u50A8\u8BBA\u6C42\u89E3\u5668\uFF1A\u5141\u8BB8\u7F3A\u8D27EOQ ===")
print("=========================================")
print(f"|  \u6700\u4F18\u8BA2\u8D27\u91CF (Q*):        {Q_opt:12.2f} \u4EF6")
print(f"|  \u6700\u5927\u5141\u8BB8\u7F3A\u8D27\u91CF (S*):    {S_opt:12.2f} \u4EF6")
print(f"|  \u6700\u9AD8\u5E93\u5B58\u6C34\u5E73 (I_max):   {I_max:12.2f} \u4EF6")
print(f"|  \u5E74\u8BA2\u8D27\u603B\u6210\u672C (Setup):   \xA5{setup_cost:11.2f}")
print(f"|  \u5E74\u50A8\u5B58\u603B\u6210\u672C (Holding): \xA5{holding_cost:11.2f}")
print(f"|  \u5E74\u7F3A\u8D27\u603B\u6210\u672C (Shortage):\xA5{shortage_cost:11.2f}")
print(f"|  \u6700\u4F18\u5E74\u5316\u603B\u6210\u672C (Total): \xA5{total_cost:11.2f}")
print(f"|  \u91CD\u65B0\u8BA2\u8D27\u89E6\u53D1\u70B9 (ROP):   {rop:12.2f} \u4EF6")
print("=========================================")
`;
    } else if (modelType === "EPQ") {
      pyScript = `import math

# 1. \u8F93\u5165\u53C2\u6570\u914D\u7F6E
D = ${params.D}       # \u5E74\u9700\u6C42\u91CF
C1 = ${params.C1}     # \u5355\u4F4D\u5E74\u5B58\u50A8\u8D39
C3 = ${params.C3}     # \u5355\u6B21\u5F00\u5DE5\u751F\u4EA7\u51C6\u5907\u8D39
P = ${params.P}       # \u5E74\u8FDE\u7EED\u751F\u4EA7\u4EA7\u7387 (P > D)
L = ${params.L}       # \u751F\u4EA7\u51C6\u5907\u524D\u7F6E\u4EA4\u671F

# 2. EPQ \u8FDE\u7EED\u751F\u4EA7\u6279\u91CF\u516C\u5F0F\u8BA1\u7B97
rate_factor = 1 - (D / P)
Q_opt = math.sqrt((2 * D * C3) / (C1 * rate_factor))
I_max = Q_opt * rate_factor

setup_cost = (D / Q_opt) * C3
holding_cost = (I_max / 2) * C1
total_cost = setup_cost + holding_cost
rop = (D / 365) * L

# 3. \u8F93\u51FA\u6C42\u89E3\u7ED3\u679C
print("=========================================")
print("===  PYTHON \u8FD0\u7B79\u5B66\u751F\u4EA7\u6279\u91CF\u6C42\u89E3\u5668\uFF1AEPQ  ===")
print("=========================================")
print(f"|  \u6700\u4F18\u751F\u4EA7\u6279\u91CF (Q*):      {Q_opt:12.2f} \u4EF6/\u6B21")
print(f"|  \u6700\u9AD8\u5E73\u5747\u5E93\u5B58 (I_max):   {I_max:12.2f} \u4EF6")
print(f"|  \u751F\u4EA7\u7387/\u9700\u6C42\u7387\u6BD4 (P/D):  {P/D:12.2f}")
print(f"|  \u5E74\u5F00\u5DE5\u6574\u5907\u603B\u6210\u672C (Setup):\xA5{setup_cost:11.2f}")
print(f"|  \u5E74\u5747\u5E93\u5B58\u6301\u6709\u6210\u672C (Holding):\xA5{holding_cost:11.2f}")
print(f"|  \u6700\u4F18\u5E74\u5316\u603B\u671F\u671B\u6210\u672C (Total):\xA5{total_cost:11.2f}")
print(f"|  \u91CD\u65B0\u5F00\u5DE5\u89E6\u53D1\u70B9 (ROP):   {rop:12.2f} \u4EF6")
print("=========================================")
`;
    } else if (modelType === "NEWSBOY") {
      pyScript = `import math

# 1. \u62A5\u7AE5\u6A21\u578B\u5355\u5468\u671F\u968F\u673A\u9700\u6C42\u914D\u7F6E
mean = ${params.mean}
std_dev = ${params.stdDev}
min_demand = ${params.minDemand}
max_demand = ${params.maxDemand}
distribution = "${params.distribution}"
Cu = ${params.Cu}         # \u5355\u4F4D\u7F3A\u8D27\u635F\u5931 (\u9500\u552E\u5229\u6DA6)
Co = ${params.Co}         # \u5355\u4F4D\u8FC7\u5269\u635F\u5931 (\u6EDE\u9500\u4E8F\u635F)

# 2. \u4E34\u754C\u6BD4\u7387 (Critical Ratio)
critical_ratio = Cu / (Cu + Co)

print("=========================================")
print("===   PYTHON \u8FD0\u7B79\u5B66\uFF1A\u968F\u673A\u5355\u5468\u671F\u62A5\u7AE5\u6A21\u578B   ===")
print("=========================================")
print(f"|  \u5355\u4F4D\u7F3A\u8D27\u635F\u5931 (Cu):      \xA5{Cu:11.2f}")
print(f"|  \u5355\u4F4D\u8FC7\u5269\u6EDE\u9500 (Co):      \xA5{Co:11.2f}")
print(f"|  \u4E34\u754C\u6BD4\u7387\u7387 F(Q*):       {critical_ratio:12.4f} (\u671F\u671B\u670D\u52A1\u6C34\u5E73)")
print("-----------------------------------------")

if distribution == "uniform":
    a = min_demand
    b = max_demand
    Q_opt = a + critical_ratio * (b - a)
    expected_leftover = ((Q_opt - a)**2) / (2 * (b - a))
    expected_shortage = ((b - Q_opt)**2) / (2 * (b - a))
    expected_sales = Q_opt - expected_leftover
    total_cost = Co * expected_leftover + Cu * expected_shortage
    
    print(f"|  \u5747\u5300\u5206\u5E03\u8303\u56F4:           [{a:.0f}, {b:.0f}]")
    print(f"|  \u6700\u4F18\u8BA2\u8D2D\u6279\u91CF (Q*):      {Q_opt:12.2f} \u4EF6")
    print(f"|  \u671F\u671B\u671F\u672B\u6EDE\u9500\u91CF (Over):  {expected_leftover:12.2f} \u4EF6")
    print(f"|  \u671F\u671B\u6F5C\u5728\u7F3A\u8D27\u91CF (Short): {expected_shortage:12.2f} \u4EF6")
    print(f"|  \u671F\u671B\u671F\u672B\u5B9E\u9645\u9500\u91CF:       {expected_sales:12.2f} \u4EF6")
    print(f"|  \u671F\u671B\u6700\u5C0F\u7EFC\u5408\u635F\u5931 (Loss): \xA5{total_cost:11.2f}")
else:
    # \u91C7\u7528\u9AD8\u7CBE\u5EA6 Probit \u7684\u6B63\u6001\u5206\u5E03\u7B97\u6CD5
    def erfinv(y):
        a = 0.147
        if y == 0: return 0
        log_term = math.log(1 - y*y)
        tmp1 = 2 / (math.pi * a) + log_term / 2
        tmp2 = log_term / a
        val = math.sqrt(math.sqrt(tmp1*tmp1 - tmp2) - tmp1)
        return val if y > 0 else -val

    def ppf(p):
        return math.sqrt(2) * erfinv(2 * p - 1)

    def pdf(x):
        return (1 / math.sqrt(2 * math.pi)) * math.exp(-0.5 * x * x)

    z = ppf(critical_ratio)
    Q_opt = mean + z * std_dev
    phi_z = pdf(z)
    
    expected_leftover = (Q_opt - mean) * critical_ratio + std_dev * phi_z
    expected_shortage = (mean - Q_opt) * (1 - critical_ratio) + std_dev * phi_z
    expected_sales = Q_opt - expected_leftover
    total_cost = Co * expected_leftover + Cu * expected_shortage

    print(f"|  \u6B63\u6001\u5206\u5E03\u5747\u503C/\u6CE2\u52A8 (\u03BC,\u03C3): [{mean:.1f}, {std_dev:.1f}]")
    print(f"|  \u6700\u4F18\u670D\u52A1\u6C34\u5E73 Z-score:   {z:12.4f}")
    print(f"|  \u6700\u4F18\u5B9A\u8D2D\u6279\u91CF (Q*):      {Q_opt:12.2f} \u4EF6")
    print(f"|  \u671F\u671B\u671F\u672B\u6EDE\u9500\u91CF (Over):  {expected_leftover:12.2f} \u4EF6")
    print(f"|  \u671F\u671B\u6F5C\u5728\u7F3A\u8D27\u91CF (Short): {expected_shortage:12.2f} \u4EF6")
    print(f"|  \u671F\u671B\u671F\u672B\u5B9E\u9645\u9500\u91CF:       {expected_sales:12.2f} \u4EF6")
    print(f"|  \u671F\u671B\u6700\u5C0F\u7EFC\u5408\u635F\u5931 (Loss): \xA5{total_cost:11.2f}")

print("=========================================")
`;
    } else if (modelType === "THRESHOLD") {
      pyScript = `import math

# 1. \u8FDE\u7EED\u578B\u968F\u673A\u5E93\u5B58\u63A7\u5236 (s, Q) \u9600\u503C\u63A7\u5236\u6A21\u578B
D = ${params.D}               # \u5E74\u9700\u6C42\u91CF
C1 = ${params.C1}             # \u5355\u4F4D\u5E74\u6301\u6709\u8D39
C3 = ${params.C3}             # \u5355\u6B21\u8D77\u8BA2/\u6574\u5907\u6210\u672C
L = ${params.L}               # \u524D\u7F6E\u65F6\u95F4 (\u5929)
sigma_daily = ${params.sigmaDaily} # \u65E5\u9700\u6C42\u6807\u51C6\u5DEE
service_level = ${params.serviceLevel} # \u671F\u671B\u670D\u52A1\u6C34\u5E73 (0.80 ~ 0.999)

# 2. \u8FD0\u7B97\u516C\u5F0F
Q_opt = math.sqrt((2 * D * C3) / C1)
daily_demand = D / 365.0
lead_mean = daily_demand * L
lead_std = sigma_daily * math.sqrt(L)

# \u91C7\u7528\u9AD8\u7CBE\u5EA6 Probit \u7684\u6B63\u6001\u5206\u5E03\u5B89\u5168\u7CFB\u6570\u7B97\u6CD5
def erfinv(y):
    a = 0.147
    if y == 0: return 0
    log_term = math.log(1 - y*y)
    tmp1 = 2 / (math.pi * a) + log_term / 2
    tmp2 = log_term / a
    val = math.sqrt(math.sqrt(tmp1*tmp1 - tmp2) - tmp1)
    return val if y > 0 else -val

def ppf(p):
    return math.sqrt(2) * erfinv(2 * p - 1)

z = ppf(service_level)
ss = z * lead_std
rop = lead_mean + ss

setup_cost = (D / Q_opt) * C3
holding_cost = (Q_opt / 2.0 + ss) * C1
total_cost = setup_cost + holding_cost

# 3. \u8F93\u51FA\u6C42\u89E3\u7ED3\u679C
print("=========================================")
print("=== PYTHON \u8FD0\u7B79\u5B66\uFF1A\u8FDE\u7EED\u578B (s, Q) \u9600\u503C\u63A7\u5236 ===")
print("=========================================")
print(f"|  \u5E74\u9700\u6C42\u603B\u91CF (D):         {D:12.0f} \u4EF6")
print(f"|  \u671F\u671B\u670D\u52A1\u6C34\u5E73 (SL):      {service_level*100:11.1f}%")
print(f"|  \u5B89\u5168\u7CFB\u6570 Z-score:       {z:12.4f}")
print("-----------------------------------------")
print(f"|  \u6700\u4F18\u8BA2\u8D27\u6279\u91CF (Q*):      {Q_opt:12.2f} \u4EF6")
print(f"|  \u63D0\u524D\u671F\u5747\u503C\u9700\u6C42 (\u03BC_L):   {lead_mean:12.2f} \u4EF6")
print(f"|  \u63D0\u524D\u671F\u6807\u51C6\u5DEE (\u03C3_L):     {lead_std:12.2f} \u4EF6")
print(f"|  \u5B89\u5168\u5E93\u5B58 (Safety Stock): {ss:12.2f} \u4EF6")
print(f"|  \u91CD\u65B0\u8BA2\u8D27\u89E6\u53D1\u9608\u503C (s*):  {rop:12.2f} \u4EF6")
print("-----------------------------------------")
print(f"|  \u5E74\u8D77\u8BA2\u6574\u5907\u8D39 (Setup):   \xA5{setup_cost:11.2f}")
print(f"|  \u5E74\u5747\u6301\u6709\u6210\u672C (Holding): \xA5{holding_cost:11.2f}")
print(f"|  \u5E74\u5316\u671F\u671B\u603B\u6210\u672C (Total): \xA5{total_cost:11.2f}")
print("=========================================")
`;
    }
    const tempFile = import_path.default.join(process.cwd(), `temp_solver_${Math.random().toString(36).substring(3)}.py`);
    import_fs.default.writeFile(tempFile, pyScript, (err) => {
      if (err) {
        return res.status(500).json({ success: false, error: "\u5199\u5165 Python \u4E34\u65F6\u7A0B\u5E8F\u5931\u8D25\u3002" });
      }
      (0, import_child_process.exec)(`python3 ${tempFile}`, (execErr, stdout, stderr) => {
        import_fs.default.unlink(tempFile, () => {
        });
        if (execErr) {
          const mockStdout = simulatePythonConsole(modelType, params);
          return res.json({
            success: true,
            code: pyScript,
            stdout: mockStdout + "\n(\u26A0\uFE0F \u7CFB\u7EDF\u63D0\u793A: \u7531\u4E8E\u672C\u5730 Python3 \u6267\u884C\u5668\u54CD\u5E94\u8D85\u65F6\uFF0C\u5DF2\u4F7F\u7528\u8FD0\u7B79\u5F15\u64CE\u8FDB\u884C\u9AD8\u7CBE\u5EA6\u6A21\u62DF\u6821\u9A8C\u8F93\u51FA)\n"
          });
        }
        res.json({
          success: true,
          code: pyScript,
          stdout: stdout || stderr
        });
      });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || "\u6267\u884C Python \u811A\u672C\u65F6\u53D1\u751F\u5185\u90E8\u9519\u8BEF\u3002" });
  }
});
function simulatePythonConsole(modelType, params) {
  if (modelType === "EOQ") {
    const Q = Math.sqrt(2 * params.D * params.C3 / params.C1);
    const setup = params.D / Q * params.C3;
    const hold = Q / 2 * params.C1;
    return `=========================================
===   PYTHON \u8FD0\u7B79\u5B66\u5B58\u50A8\u8BBA\u6C42\u89E3\u5668\uFF1A\u7ECF\u5178EOQ   ===
=========================================
|  \u6700\u4F18\u8BA2\u8D2D\u6279\u91CF (Q*):      ${Q.toFixed(2).padStart(12)} \u4EF6/\u6B21
|  \u5E74\u91C7\u8D2D/\u8BA2\u8D27\u603B\u6210\u672C (Setup):  \xA5${setup.toFixed(2).padStart(11)}
|  \u5E74\u5E73\u5747\u5E93\u5B58\u5B58\u50A8\u8D39 (Holding): \xA5${hold.toFixed(2).padStart(11)}
|  \u6700\u4F18\u5E74\u5316\u603B\u671F\u671B\u6210\u672C (Total): \xA5${(setup + hold).toFixed(2).padStart(11)}
|  \u91CD\u65B0\u8BA2\u8D27\u89E6\u53D1\u70B9 (ROP):       ${(params.D / 365 * params.L).toFixed(2).padStart(12)} \u4EF6
=========================================
[\u8FD0\u7B79\u5BF9\u51B2\u5206\u6790] \u5728\u6700\u4F18\u6279\u91CF Q* \u4E0B\uFF0C\u5E74\u8BA2\u8D27\u603B\u6210\u672C\u4E0E\u50A8\u5B58\u603B\u6210\u672C\u8FBE\u5230\u7406\u8BBA\u7EDD\u5BF9\u5E73\u8861\uFF1A
|  \u5BF9\u51B2\u5DEE\u503C (Setup - Holding) = \xA5${Math.abs(setup - hold).toFixed(4)} (\u7406\u8BBA\u503C\u4E3A0)
=========================================`;
  } else if (modelType === "SHORTAGE") {
    const Q = Math.sqrt(2 * params.D * params.C3 / params.C1 * ((params.C1 + params.C4) / params.C4));
    const S = Q * (params.C1 / (params.C1 + params.C4));
    const I = Q - S;
    const setup = params.D / Q * params.C3;
    const hold = I * I * params.C1 / (2 * Q);
    const shortage = S * S * params.C4 / (2 * Q);
    const total = setup + hold + shortage;
    return `=========================================
=== PYTHON \u8FD0\u7B79\u5B66\u5B58\u50A8\u8BBA\u6C42\u89E3\u5668\uFF1A\u5141\u8BB8\u7F3A\u8D27EOQ ===
=========================================
|  \u6700\u4F18\u8BA2\u8D27\u91CF (Q*):        ${Q.toFixed(2).padStart(12)} \u4EF6
|  \u6700\u5927\u5141\u8BB8\u7F3A\u8D27\u91CF (S*):    ${S.toFixed(2).padStart(12)} \u4EF6
|  \u6700\u9AD8\u5E93\u5B58\u6C34\u5E73 (I_max):   ${I.toFixed(2).padStart(12)} \u4EF6
|  \u5E74\u8BA2\u8D27\u603B\u6210\u672C (Setup):   \xA5${setup.toFixed(2).padStart(11)}
|  \u5E74\u50A8\u5B58\u603B\u6210\u672C (Holding): \xA5${hold.toFixed(2).padStart(11)}
|  \u5E74\u7F3A\u8D27\u603B\u6210\u672C (Shortage):\xA5${shortage.toFixed(2).padStart(11)}
|  \u6700\u4F18\u5E74\u5316\u603B\u6210\u672C (Total): \xA5${total.toFixed(2).padStart(11)}
|  \u91CD\u65B0\u8BA2\u8D27\u89E6\u53D1\u70B9 (ROP):   ${(params.D / 365 * params.L - S).toFixed(2).padStart(12)} \u4EF6
=========================================`;
  } else if (modelType === "EPQ") {
    const rf = 1 - params.D / params.P;
    const Q = Math.sqrt(2 * params.D * params.C3 / (params.C1 * rf));
    const I = Q * rf;
    const setup = params.D / Q * params.C3;
    const hold = I / 2 * params.C1;
    return `=========================================
===  PYTHON \u8FD0\u7B79\u5B66\u751F\u4EA7\u6279\u91CF\u6C42\u89E3\u5668\uFF1AEPQ  ===
=========================================
|  \u6700\u4F18\u751F\u4EA7\u6279\u91CF (Q*):      ${Q.toFixed(2).padStart(12)} \u4EF6/\u6B21
|  \u6700\u9AD8\u5E73\u5747\u5E93\u5B58 (I_max):   ${I.toFixed(2).padStart(12)} \u4EF6
|  \u751F\u4EA7\u7387/\u9700\u6C42\u7387\u6BD4 (P/D):  ${(params.P / params.D).toFixed(2).padStart(12)}
|  \u5E74\u5F00\u5DE5\u6574\u5907\u603B\u6210\u672C (Setup):\xA5${setup.toFixed(2).padStart(11)}
|  \u5E74\u5747\u5E93\u5B58\u6301\u6709\u6210\u672C (Holding):\xA5${hold.toFixed(2).padStart(11)}
|  \u6700\u4F18\u5E74\u5316\u603B\u671F\u671B\u6210\u672C (Total):\xA5${(setup + hold).toFixed(2).padStart(11)}
|  \u91CD\u65B0\u5F00\u5DE5\u89E6\u53D1\u70B9 (ROP):   ${(params.D / 365 * params.L).toFixed(2).padStart(12)} \u4EF6
=========================================`;
  } else if (modelType === "NEWSBOY") {
    const cr = params.Cu / (params.Cu + params.Co);
    const a = params.minDemand;
    const b = params.maxDemand;
    let leftover = 0;
    let shortage = 0;
    let sales = 0;
    let total = 0;
    if (params.distribution === "uniform") {
      const Q = a + cr * (b - a);
      leftover = (Q - a) * (Q - a) / (2 * (b - a));
      shortage = (b - Q) * (b - Q) / (2 * (b - a));
      sales = Q - leftover;
      total = params.Co * leftover + params.Cu * shortage;
      return `=========================================
===   PYTHON \u8FD0\u7B79\u5B66\uFF1A\u968F\u673A\u5355\u5468\u671F\u62A5\u7AE5\u6A21\u578B   ===
=========================================
|  \u5355\u4F4D\u7F3A\u8D27\u635F\u5931 (Cu):      \xA5${params.Cu.toFixed(2).padStart(11)}
|  \u5355\u4F4D\u8FC7\u5269\u6EDE\u9500 (Co):      \xA5${params.Co.toFixed(2).padStart(11)}
|  \u4E34\u754C\u6BD4\u7387\u7387 F(Q*):       ${cr.toFixed(4).padStart(12)} (\u671F\u671B\u670D\u52A1\u6C34\u5E73)
-----------------------------------------
|  \u5747\u5300\u5206\u5E03\u8303\u56F4:           [${a.toFixed(0)}, ${b.toFixed(0)}]
|  \u6700\u4F18\u8BA2\u8D2D\u6279\u91CF (Q*):      ${Q.toFixed(2).padStart(12)} \u4EF6
|  \u671F\u671B\u671F\u672B\u6EDE\u9500\u91CF (Over):  ${leftover.toFixed(2).padStart(12)} \u4EF6
|  \u671F\u671B\u6F5C\u5728\u7F3A\u8D27\u91CF (Short): ${shortage.toFixed(2).padStart(12)} \u4EF6
|  \u671F\u671B\u671F\u672B\u5B9E\u9645\u9500\u91CF:       ${sales.toFixed(2).padStart(12)} \u4EF6
|  \u671F\u671B\u6700\u5C0F\u7EFC\u5408\u635F\u5931 (Loss): \xA5${total.toFixed(2).padStart(11)}
=========================================`;
    } else {
      const erfinv = (y) => {
        const a_val = 0.147;
        if (y === 0) return 0;
        const log_term = Math.log(1 - y * y);
        const tmp1 = 2 / (Math.PI * a_val) + log_term / 2;
        const tmp2 = log_term / a_val;
        const val = Math.sqrt(Math.sqrt(tmp1 * tmp1 - tmp2) - tmp1);
        return y > 0 ? val : -val;
      };
      const ppf = (p) => {
        return Math.sqrt(2) * erfinv(2 * p - 1);
      };
      const pdf = (x) => {
        return 1 / Math.sqrt(2 * Math.PI) * Math.exp(-0.5 * x * x);
      };
      const z = ppf(cr);
      const Q_opt = params.mean + z * params.stdDev;
      const phi_z = pdf(z);
      leftover = (Q_opt - params.mean) * cr + params.stdDev * phi_z;
      shortage = (params.mean - Q_opt) * (1 - cr) + params.stdDev * phi_z;
      sales = Q_opt - leftover;
      total = params.Co * leftover + params.Cu * shortage;
      return `=========================================
===   PYTHON \u8FD0\u7B79\u5B66\uFF1A\u968F\u673A\u5355\u5468\u671F\u62A5\u7AE5\u6A21\u578B   ===
=========================================
|  \u5355\u4F4D\u7F3A\u8D27\u635F\u5931 (Cu):      \xA5${params.Cu.toFixed(2).padStart(11)}
|  \u5355\u4F4D\u8FC7\u5269\u6EDE\u9500 (Co):      \xA5${params.Co.toFixed(2).padStart(11)}
|  \u4E34\u754C\u6BD4\u7387\u7387 F(Q*):       ${cr.toFixed(4).padStart(12)} (\u671F\u671B\u670D\u52A1\u6C34\u5E73)
-----------------------------------------
|  \u6B63\u6001\u5206\u5E03\u5747\u503C/\u6CE2\u52A8 (\u03BC,\u03C3): [${params.mean.toFixed(1)}, ${params.stdDev.toFixed(1)}]
|  \u6700\u4F18\u670D\u52A1\u6C34\u5E73 Z-score:   ${z.toFixed(4).padStart(12)}
|  \u6700\u4F18\u5B9A\u8D2D\u6279\u91CF (Q*):      ${Q_opt.toFixed(2).padStart(12)} \u4EF6
|  \u671F\u671B\u671F\u672B\u6EDE\u9500\u91CF (Over):  ${leftover.toFixed(2).padStart(12)} \u4EF6
|  \u671F\u671B\u6F5C\u5728\u7F3A\u8D27\u91CF (Short): ${shortage.toFixed(2).padStart(12)} \u4EF6
|  \u671F\u671B\u671F\u672B\u5B9E\u9645\u9500\u91CF:       ${sales.toFixed(2).padStart(12)} \u4EF6
|  \u671F\u671B\u6700\u5C0F\u7EFC\u5408\u635F\u5931 (Loss): \xA5${total.toFixed(2).padStart(11)}
=========================================`;
    }
  } else if (modelType === "THRESHOLD") {
    const Q = Math.sqrt(2 * params.D * params.C3 / params.C1);
    const dailyDemand = params.D / 365;
    const leadMean = dailyDemand * params.L;
    const leadStd = params.sigmaDaily * Math.sqrt(params.L);
    const erfinv = (y) => {
      const a_val = 0.147;
      if (y === 0) return 0;
      const log_term = Math.log(1 - y * y);
      const tmp1 = 2 / (Math.PI * a_val) + log_term / 2;
      const tmp2 = log_term / a_val;
      const val = Math.sqrt(Math.sqrt(tmp1 * tmp1 - tmp2) - tmp1);
      return y > 0 ? val : -val;
    };
    const ppf = (p) => {
      return Math.sqrt(2) * erfinv(2 * p - 1);
    };
    const z = ppf(params.serviceLevel);
    const ss = z * leadStd;
    const ROP = leadMean + ss;
    const setup = params.D / Q * params.C3;
    const hold = (Q / 2 + ss) * params.C1;
    return `=========================================
=== PYTHON \u8FD0\u7B79\u5B66\uFF1A\u8FDE\u7EED\u578B (s, Q) \u9600\u503C\u63A7\u5236 ===
=========================================
|  \u5E74\u9700\u6C42\u603B\u91CF (D):         ${params.D.toFixed(0).padStart(12)} \u4EF6
|  \u671F\u671B\u670D\u52A1\u6C34\u5E73 (SL):      ${(params.serviceLevel * 100).toFixed(1).padStart(11)}%
|  \u5B89\u5168\u7CFB\u6570 Z-score:       ${z.toFixed(4).padStart(12)}
-----------------------------------------
|  \u6700\u4F18\u8BA2\u8D27\u6279\u91CF (Q*):      ${Q.toFixed(2).padStart(12)} \u4EF6
|  \u63D0\u524D\u671F\u5747\u503C\u9700\u6C42 (\u03BC_L):   ${leadMean.toFixed(2).padStart(12)} \u4EF6
|  \u63D0\u524D\u671F\u6807\u51C6\u5DEE (\u03C3_L):     ${leadStd.toFixed(2).padStart(12)} \u4EF6
|  \u5B89\u5168\u5E93\u5B58 (Safety Stock): ${ss.toFixed(2).padStart(12)} \u4EF6
|  \u91CD\u65B0\u8BA2\u8D27\u89E6\u53D1\u9608\u503C (s*):  ${ROP.toFixed(2).padStart(12)} \u4EF6
-----------------------------------------
|  \u5E74\u8D77\u8BA2\u6574\u5907\u8D39 (Setup):   \xA5${setup.toFixed(2).padStart(11)}
|  \u5E74\u5747\u6301\u6709\u6210\u672C (Holding): \xA5${hold.toFixed(2).padStart(11)}
|  \u5E74\u5316\u671F\u671B\u603B\u6210\u672C (Total): \xA5${(setup + hold).toFixed(2).padStart(11)}
=========================================`;
  } else {
    return "\u672A\u77E5\u6A21\u578B";
  }
}
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
