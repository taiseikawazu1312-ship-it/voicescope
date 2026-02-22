"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import type { QualityScore } from "@/types";

interface QualityRadarProps {
  qualityScore: QualityScore;
}

export function QualityRadar({ qualityScore }: QualityRadarProps) {
  const data = [
    {
      axis: "具体性",
      value: qualityScore.specificityScore ?? 0,
      fullMark: 5,
    },
    {
      axis: "深さ",
      value: qualityScore.depthScore ?? 0,
      fullMark: 5,
    },
    {
      axis: "一貫性",
      value: qualityScore.consistencyScore ?? 0,
      fullMark: 5,
    },
    {
      axis: "情報量",
      value: qualityScore.informationScore ?? 0,
      fullMark: 5,
    },
    {
      axis: "独自性",
      value: qualityScore.uniquenessScore ?? 0,
      fullMark: 5,
    },
  ];

  return (
    <div className="flex flex-col items-center">
      {/* 総合スコア */}
      <div className="mb-2 flex flex-col items-center">
        <p className="text-sm text-muted-foreground">総合スコア</p>
        <p className="text-4xl font-bold text-[#1A1A2E]">
          {qualityScore.overallScore.toFixed(1)}
        </p>
        <p className="text-xs text-muted-foreground">/ 5.0</p>
      </div>

      {/* レーダーチャート */}
      <div className="h-[280px] w-full max-w-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fill: "#64748b", fontSize: 12 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 5]}
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              tickCount={6}
            />
            <Radar
              name="品質スコア"
              dataKey="value"
              stroke="#4A3AFF"
              fill="#4A3AFF"
              fillOpacity={0.2}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* 個別スコア一覧 */}
      <div className="mt-2 grid w-full grid-cols-5 gap-2 text-center">
        {data.map((d) => (
          <div key={d.axis}>
            <p className="text-xs text-muted-foreground">{d.axis}</p>
            <p className="text-sm font-semibold">{d.value.toFixed(1)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
