"use client";

import React, { useMemo, useState } from "react";

type LocationType = "Coordinates" | "Country";
type Irrig = "Rainfed" | "Irrigated" | "Mixed" | "Unknown" | "All";
type AggregationPreference = "Watershed" | "Crop" | "Business Unit";
type ResultsView = "summary" | "table" | "charts";

type Row = {
  id: string;
  locationType: LocationType;
  location: string;
  state?: string;
  latitude?: string;
  longitude?: string;
  bufferKm: string;
  crop: string;
  irrigation: Irrig;
  quantity: string;
  riskIndicator: string;
  errors?: Partial<Record<"location" | "latitude" | "longitude" | "bufferKm" | "crop" | "quantity" | "riskIndicator", string>>;
};

type ResultRow = {
  watershedId: number;
  crop: string;
  businessUnit: string;
  region: string;
  irrigation: Exclude<Irrig, "All">;
  total: number;
  disagg: number;
  range: string;
  label: string;
};

type DisplayedResult = {
  groupKey: string;
  watershedId: string;
  crop: string;
  total: number;
  disagg: number;
  range: string;
  label: string;
};

const CROPS = ["Maize", "Wheat", "Rice", "Soybean", "Cotton", "Sugarcane", "Barley", "Sorghum"] as const;
const COUNTRY_OPTIONS = ["Brazil"] as const;
const BRAZIL_STATES = [
  "Acre",
  "Alagoas",
  "Amapá",
  "Amazonas",
  "Bahia",
  "Ceará",
  "Distrito Federal",
  "Espírito Santo",
  "Goiás",
  "Maranhão",
  "Mato Grosso",
  "Mato Grosso do Sul",
  "Minas Gerais",
  "Pará",
  "Paraíba",
  "Paraná",
  "Pernambuco",
  "Piauí",
  "Rio de Janeiro",
  "Rio Grande do Norte",
  "Rio Grande do Sul",
  "Rondônia",
  "Roraima",
  "Santa Catarina",
  "São Paulo",
  "Sergipe",
  "Tocantins",
] as const;
const RISK_INDICATORS = [
  "WRI-Aqueduct Food Analysis",
  "SBTN-Freshwater Quantity",
  "SBTN-Freshwater Quality",
] as const;
const AGGREGATION_OPTIONS: AggregationPreference[] = ["Watershed", "Crop", "Business Unit"];

const INDICATOR_TOOLTIPS: Record<string, { title: string; detail: string }> = {
  "WRI-Aqueduct Food Analysis": {
    title: "WRI Aqueduct Food Analysis",
    detail: "Aqueduct-based analysis tailored for agricultural supply chains and crop-level water risk screening.",
  },
  "SBTN-Freshwater Quantity": {
    title: "SBTN Freshwater Quantity",
    detail: "Science Based Targets Network freshwater quantity indicator for assessing water availability and depletion risks.",
  },
  "SBTN-Freshwater Quality": {
    title: "SBTN Freshwater Quality",
    detail: "Science Based Targets Network freshwater quality indicator for evaluating pollution-related water risks.",
  },
};

const resultsSeed: ResultRow[] = [
  { watershedId: 774401, crop: "Wheat", businessUnit: "Cereals", region: "South America", irrigation: "Irrigated", total: 18000, disagg: 95.2, range: "> 100%", label: "Extremely High (>80%)" },
  { watershedId: 774405, crop: "Wheat", businessUnit: "Cereals", region: "South America", irrigation: "Rainfed", total: 26836, disagg: 110.35, range: "20–40%", label: "Medium to High (20–40%)" },
  { watershedId: 774402, crop: "Maize", businessUnit: "Cereals", region: "South America", irrigation: "Rainfed", total: 42000, disagg: 310.1, range: "0–10%", label: "Low (<10%)" },
  { watershedId: 774406, crop: "Maize", businessUnit: "Cereals", region: "South America", irrigation: "Mixed", total: 38000, disagg: 275.0, range: "40–80%", label: "High (40–80%)" },
  { watershedId: 774407, crop: "Maize", businessUnit: "Cereals", region: "South America", irrigation: "Irrigated", total: 40000, disagg: 315.0, range: "> 100%", label: "Extremely High (>80%)" },
  { watershedId: 774403, crop: "Rice", businessUnit: "Staples", region: "Asia", irrigation: "Irrigated", total: 30000, disagg: 250.0, range: "20–40%", label: "Medium to High (20–40%)" },
  { watershedId: 774408, crop: "Rice", businessUnit: "Staples", region: "Asia", irrigation: "Mixed", total: 20200, disagg: 200.0, range: "40–80%", label: "High (40–80%)" },
  { watershedId: 774404, crop: "Soybean", businessUnit: "Oilseeds", region: "South America", irrigation: "Rainfed", total: 22000, disagg: 160.0, range: "0–10%", label: "Low (<10%)" },
  { watershedId: 774409, crop: "Soybean", businessUnit: "Oilseeds", region: "South America", irrigation: "Irrigated", total: 46000, disagg: 360.0, range: "40–80%", label: "High (40–80%)" },
];

const validateRow = (r: Row) => {
  const errors: Row["errors"] = {};
  if (!r.location) errors.location = "Required";

  if (r.locationType === "Coordinates") {
    if (!r.latitude) errors.latitude = "Required";
    if (!r.longitude) errors.longitude = "Required";
    const lat = Number(r.latitude);
    const lon = Number(r.longitude);
    if (r.latitude && (isNaN(lat) || lat < -90 || lat > 90)) errors.latitude = "Latitude must be between -90 and 90";
    if (r.longitude && (isNaN(lon) || lon < -180 || lon > 180)) errors.longitude = "Longitude must be between -180 and 180";
  }

  if (r.bufferKm) {
    const b = Number(r.bufferKm);
    if (isNaN(b) || b <= 0 || b > 200) errors.bufferKm = "1–200 km";
  }

  if (!r.crop) errors.crop = "Required";
  if (!r.quantity) errors.quantity = "Required";
  const q = Number(r.quantity);
  if (isNaN(q) || q <= 0) errors.quantity = "> 0";
  if (!r.riskIndicator) errors.riskIndicator = "Select one";
  return errors;
};

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={cx("rounded-2xl border border-slate-200 bg-white shadow-sm", className)}>{children}</div>;
}
function CardHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={cx("p-4 pb-0", className)}>{children}</div>;
}
function CardContent({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={cx("p-4", className)}>{children}</div>;
}
function CardTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={cx("text-base font-semibold text-slate-900", className)}>{children}</div>;
}
function CardDescription({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={cx("mt-1 text-sm text-slate-500", className)}>{children}</div>;
}
function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "danger" | "ok" | "info" }) {
  const map = {
    neutral: "bg-slate-100 text-slate-700 border-slate-200",
    danger: "bg-red-50 text-red-700 border-red-200",
    ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
    info: "bg-blue-50 text-blue-700 border-blue-200",
  } as const;
  return <span className={cx("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium", map[tone])}>{children}</span>;
}
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-xs font-medium text-slate-700">{children}</label>;
}
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx("h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none placeholder:text-slate-400 disabled:bg-slate-100 disabled:text-slate-400", props.className)} />;
}
function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx("h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none disabled:bg-slate-100 disabled:text-slate-400", props.className)} />;
}
function SmallIcon({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 text-[11px] text-slate-600">{children}</span>;
}
function Pill({ ok }: { ok: boolean }) {
  return <span className={cx("inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold", ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>{ok ? "✓" : "!"}</span>;
}

function ChartLegend() {
  return (
    <div className="flex flex-wrap gap-4 pt-2 text-xs text-slate-600">
      <div className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-green-300" />Low</div>
      <div className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-yellow-300" />Medium to High</div>
      <div className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-orange-400" />High</div>
      <div className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-red-500" />Extremely High</div>
    </div>
  );
}

export default function AgriculturalSupplyChainAnalyzerMock() {
  const [rows, setRows] = useState<Row[]>([]);
  const [locationType, setLocationType] = useState<LocationType>("Coordinates");
  const [location, setLocation] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [bufferKm, setBufferKm] = useState("25");
  const [crop, setCrop] = useState<string>("Maize");
  const [irrigation, setIrrigation] = useState<Irrig>("Rainfed");
  const [quantity, setQuantity] = useState("1000");
  const [selectedIndicator, setSelectedIndicator] = useState<string>("WRI-Aqueduct Food Analysis");
  const [aggregationPreference, setAggregationPreference] = useState<AggregationPreference>("Watershed");
  const [inputMode, setInputMode] = useState<"manual" | "quick">("manual");
  const [importFileName, setImportFileName] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<"aqueduct" | "food" | "asc">("asc");
  const [status, setStatus] = useState<"idle" | "ready" | "error" | "running" | "done">("idle");
  const [prodThreshold, setProdThreshold] = useState(0);
  const [sortKey, setSortKey] = useState<"total" | "disagg" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [resultsView, setResultsView] = useState<ResultsView>("summary");
  const [chartCropFilters, setChartCropFilters] = useState<string[]>([]);
  const [hoveredTip, setHoveredTip] = useState<string | null>(null);
  const [chartRegionFilter, setChartRegionFilter] = useState<string>("all");
  const [chartBusinessUnitFilter, setChartBusinessUnitFilter] = useState<string>("all");

  const availableResultCrops = useMemo(() => Array.from(new Set(rows.map((r) => r.crop).filter(Boolean))), [rows]);
  const availableRegions = useMemo(() => Array.from(new Set(resultsSeed.map((r) => r.region))), []);
  const availableBusinessUnits = useMemo(() => Array.from(new Set(resultsSeed.map((r) => r.businessUnit))), []);

  const filteredResults = useMemo(() => {
    let arr = resultsSeed.filter((r) => r.total >= prodThreshold);
    if (chartCropFilters.length > 0) arr = arr.filter((r) => chartCropFilters.includes(r.crop));
    if (chartRegionFilter !== "all") arr = arr.filter((r) => r.region === chartRegionFilter);
    if (chartBusinessUnitFilter !== "all") arr = arr.filter((r) => r.businessUnit === chartBusinessUnitFilter);
    return arr;
  }, [prodThreshold, chartCropFilters, chartRegionFilter, chartBusinessUnitFilter]);

  const displayedResults = useMemo<DisplayedResult[]>(() => {
    const riskRank = (label: string) => {
      if (label.includes("Extremely High")) return 3;
      if (label.includes("High (40–80%)")) return 2;
      if (label.includes("Medium to High")) return 1;
      return 0;
    };

    if (aggregationPreference === "Watershed") {
      const arr = [...filteredResults];
      if (sortKey) arr.sort((a, b) => (sortDir === "asc" ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]));
      else arr.sort((a, b) => a.watershedId - b.watershedId);
      return arr.map((r) => ({
        groupKey: String(r.watershedId),
        watershedId: String(r.watershedId),
        crop: r.crop,
        total: r.total,
        disagg: r.disagg,
        range: r.range,
        label: r.label,
      }));
    }

    const groupField: "crop" | "businessUnit" = aggregationPreference === "Crop" ? "crop" : "businessUnit";
    const grouped = Object.values(
      filteredResults.reduce<Record<string, DisplayedResult & { _riskRank: number }>>((acc, r) => {
        const key = r[groupField];
        if (!acc[key]) {
          acc[key] = {
            groupKey: key,
            watershedId: "Multiple",
            crop: aggregationPreference === "Crop" ? key : "Multiple",
            total: 0,
            disagg: 0,
            range: r.range,
            label: r.label,
            _riskRank: riskRank(r.label),
          };
        }
        acc[key].total += r.total;
        acc[key].disagg += r.disagg;
        if (riskRank(r.label) > acc[key]._riskRank) {
          acc[key]._riskRank = riskRank(r.label);
          acc[key].range = r.range;
          acc[key].label = r.label;
        }
        return acc;
      }, {}),
    ).map(({ _riskRank, ...rest }) => rest);

    if (sortKey) grouped.sort((a, b) => (sortDir === "asc" ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]));
    else grouped.sort((a, b) => a.groupKey.localeCompare(b.groupKey));
    return grouped;
  }, [filteredResults, aggregationPreference, sortKey, sortDir]);

  const summaryMetrics = useMemo(() => {
    const totalProduction = filteredResults.reduce((sum, r) => sum + r.total, 0);
    const highRiskProduction = filteredResults.filter((r) => r.label.includes("High (40–80%)") || r.label.includes("Extremely High")).reduce((sum, r) => sum + r.total, 0);
    const highRiskShare = totalProduction > 0 ? Math.round((highRiskProduction / totalProduction) * 100) : 0;
    const filteredInputRows = chartCropFilters.length > 0 ? rows.filter((r) => chartCropFilters.includes(String(r.crop))) : rows;
    return { totalProduction, highRiskShare, locationCount: filteredInputRows.length };
  }, [filteredResults, rows, chartCropFilters]);

  const tableWithErrors = useMemo(() => rows.map((r) => ({ ...r, errors: validateRow(r) })), [rows]);
  const allValid = useMemo(() => tableWithErrors.every((r) => !r.errors || Object.keys(r.errors).length === 0), [tableWithErrors]);

  const addRow = () => {
    const coordinateLocation = latitude && longitude ? `${latitude}, ${longitude}` : "";
    const row: Row = {
      id: crypto.randomUUID(),
      locationType,
      location: locationType === "Coordinates" ? coordinateLocation : location,
      state: locationType === "Country" ? selectedState || undefined : undefined,
      latitude: locationType === "Coordinates" ? latitude : undefined,
      longitude: locationType === "Coordinates" ? longitude : undefined,
      bufferKm,
      crop,
      irrigation,
      quantity,
      riskIndicator: selectedIndicator,
    };
    const errors = validateRow(row);
    setRows((prev) => [...prev, { ...row, errors }]);
    setStatus(Object.keys(errors).length ? "error" : "ready");
  };

  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  const runAnalysis = () => {
    if (!allValid || rows.length === 0) {
      setStatus("error");
      return;
    }
    setStatus("running");
    window.setTimeout(() => setStatus("done"), 700);
  };

  const resetResultsControls = () => {
    setProdThreshold(0);
    setSortKey(null);
    setSortDir("desc");
    setChartCropFilters([]);
    setChartRegionFilter("all");
    setChartBusinessUnitFilter("all");
  };

  const toggleSort = (key: "total" | "disagg") => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("desc");
    } else {
      setSortDir((prev) => (prev === "desc" ? "asc" : "desc"));
    }
  };

  const selectIndicator = (ind: string) => {
    setSelectedIndicator(ind);
    setRows((prev) =>
      prev.map((rr) => {
        const updated: Row = { ...rr, riskIndicator: ind };
        return { ...updated, errors: validateRow(updated) };
      }),
    );
  };

  const downloadTemplate = () => {
    const header = ["Location", "Radius (km)", "Crop", "Irrigation", "Volume (MT/year)", "Indicator"].join(",");
    const example = ["35.5, 70.5", "10", "Wheat", "All", "10", "WRI-Aqueduct Food Analysis"].join(",");
    const csv = [header, example].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "asc-analyzer-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusBadge = (() => {
    if (status === "ready") return <Badge tone="ok">Ready</Badge>;
    if (status === "error") return <Badge tone="danger">Fix inputs</Badge>;
    if (status === "running") return <Badge tone="info">Analyzing…</Badge>;
    if (status === "done") return <Badge tone="ok">Results ready</Badge>;
    return <Badge tone="neutral">Idle</Badge>;
  })();

  const renderHotspots = () => {
    if (filteredResults.length === 0) {
      return <div className="flex h-64 items-center justify-center text-sm text-slate-500">No chart data matches the current filters.</div>;
    }
    const hotspots = filteredResults
      .filter((r) => r.label.includes("High (40–80%)") || r.label.includes("Extremely High"))
      .reduce<Record<string, number>>((acc, r) => {
        const key = `${r.crop} — ${r.region} — ${r.businessUnit}`;
        acc[key] = (acc[key] || 0) + r.total;
        return acc;
      }, {});
    const totalHotspot = Object.values(hotspots).reduce((s, v) => s + v, 0);
    const sorted = Object.entries(hotspots).sort((a, b) => b[1] - a[1]);
    const max = Math.max(...sorted.map(([, v]) => v), 0);
    return (
      <div className="space-y-3">
        {sorted.map(([key, value]) => {
          const width = max > 0 ? (value / max) * 100 : 0;
          const share = totalHotspot > 0 ? Math.round((value / totalHotspot) * 100) : 0;
          return (
            <div key={key} className="grid grid-cols-[180px_1fr_120px] items-center gap-3 text-sm">
              <div className="font-medium text-slate-700 truncate">{key}</div>
              <div className="h-4 rounded-full bg-slate-100">
                <div className="h-4 rounded-full bg-red-500" style={{ width: `${width}%` }} />
              </div>
              <div className="text-right text-slate-600">{value.toLocaleString()} MT ({share}%)</div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderTotalProduction = () => {
    if (filteredResults.length === 0) {
      return <div className="flex h-64 items-center justify-center text-sm text-slate-500">No chart data matches the current filters.</div>;
    }
    const grouped = filteredResults.reduce<Record<string, number>>((acc, r) => {
      acc[r.crop] = (acc[r.crop] || 0) + r.total;
      return acc;
    }, {});
    const totalProduction = Object.values(grouped).reduce((sum, value) => sum + value, 0);
    const maxValue = Math.max(...Object.values(grouped), 0);
    return (
      <div className="space-y-3">
        {Object.entries(grouped).sort((a, b) => b[1] - a[1]).map(([cropName, value]) => {
          const width = maxValue > 0 ? (value / maxValue) * 100 : 0;
          const share = totalProduction > 0 ? Math.round((value / totalProduction) * 100) : 0;
          return (
            <div key={cropName} className="grid grid-cols-[120px_1fr_140px] items-center gap-3 text-sm">
              <div className="font-medium text-slate-700">{cropName}</div>
              <div className="h-4 rounded-full bg-slate-100">
                <div className="h-4 rounded-full bg-blue-500" style={{ width: `${width}%` }} />
              </div>
              <div className="text-right text-slate-600">{value.toLocaleString()} MT ({share}%)</div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderCropRiskDistribution = () => {
    if (filteredResults.length === 0) {
      return <div className="flex h-72 items-center justify-center text-sm text-slate-500">No chart data matches the current filters.</div>;
    }
    const grouped = filteredResults.reduce<Record<string, { low: number; medium: number; high: number; extreme: number; total: number }>>((acc, r) => {
      if (!acc[r.crop]) acc[r.crop] = { low: 0, medium: 0, high: 0, extreme: 0, total: 0 };
      if (r.label.includes("Extremely High")) acc[r.crop].extreme += r.total;
      else if (r.label.includes("High (40–80%)")) acc[r.crop].high += r.total;
      else if (r.label.includes("Medium to High")) acc[r.crop].medium += r.total;
      else acc[r.crop].low += r.total;
      acc[r.crop].total += r.total;
      return acc;
    }, {});
    return (
      <div className="space-y-4">
        {Object.entries(grouped).sort((a, b) => b[1].total - a[1].total).map(([cropName, values]) => {
          const total = values.total || 1;
          const lowPct = (values.low / total) * 100;
          const mediumPct = (values.medium / total) * 100;
          const highPct = (values.high / total) * 100;
          const extremePct = (values.extreme / total) * 100;
          return (
            <div key={cropName} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="font-medium text-slate-700">{cropName}</div>
                <div className="text-slate-600">{total.toLocaleString()} MT</div>
              </div>
              <div className="flex h-5 overflow-hidden rounded-full bg-slate-100">
                {lowPct > 0 && <div className="bg-green-300" style={{ width: `${lowPct}%` }} />}
                {mediumPct > 0 && <div className="bg-yellow-300" style={{ width: `${mediumPct}%` }} />}
                {highPct > 0 && <div className="bg-orange-400" style={{ width: `${highPct}%` }} />}
                {extremePct > 0 && <div className="bg-red-500" style={{ width: `${extremePct}%` }} />}
              </div>
            </div>
          );
        })}
        <ChartLegend />
      </div>
    );
  };

  const renderIrrigationRisk = () => {
    if (filteredResults.length === 0) {
      return <div className="flex h-72 items-center justify-center text-sm text-slate-500">No chart data matches the current filters.</div>;
    }
    const grouped = filteredResults.reduce<Record<string, { low: number; medium: number; high: number; extreme: number; total: number }>>((acc, r) => {
      const key = r.irrigation;
      if (!acc[key]) acc[key] = { low: 0, medium: 0, high: 0, extreme: 0, total: 0 };
      if (r.label.includes("Extremely High")) acc[key].extreme += r.total;
      else if (r.label.includes("High (40–80%)")) acc[key].high += r.total;
      else if (r.label.includes("Medium to High")) acc[key].medium += r.total;
      else acc[key].low += r.total;
      acc[key].total += r.total;
      return acc;
    }, {});
    const order: Array<Exclude<Irrig, "All">> = ["Rainfed", "Irrigated", "Mixed", "Unknown"];
    return (
      <div className="space-y-4">
        {order.filter((label) => grouped[label]).map((label) => {
          const values = grouped[label];
          const total = values.total || 1;
          const lowPct = (values.low / total) * 100;
          const mediumPct = (values.medium / total) * 100;
          const highPct = (values.high / total) * 100;
          const extremePct = (values.extreme / total) * 100;
          const highRiskShare = Math.round(((values.high + values.extreme) / total) * 100);
          return (
            <div key={label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="font-medium text-slate-700">{label}</div>
                <div className="text-slate-600">{values.total.toLocaleString()} MT • {highRiskShare}% high risk</div>
              </div>
              <div className="flex h-5 overflow-hidden rounded-full bg-slate-100">
                {lowPct > 0 && <div className="bg-green-300" style={{ width: `${lowPct}%` }} />}
                {mediumPct > 0 && <div className="bg-yellow-300" style={{ width: `${mediumPct}%` }} />}
                {highPct > 0 && <div className="bg-orange-400" style={{ width: `${highPct}%` }} />}
                {extremePct > 0 && <div className="bg-red-500" style={{ width: `${extremePct}%` }} />}
              </div>
            </div>
          );
        })}
        <ChartLegend />
      </div>
    );
  };

  const renderProductionVsRisk = () => {
    if (filteredResults.length === 0) {
      return <div className="flex h-80 items-center justify-center text-sm text-slate-500">No chart data matches the current filters.</div>;
    }
    const grouped = Object.entries(
      filteredResults.reduce<Record<string, { total: number; highRisk: number }>>((acc, r) => {
        if (!acc[r.crop]) acc[r.crop] = { total: 0, highRisk: 0 };
        acc[r.crop].total += r.total;
        if (r.label.includes("High (40–80%)") || r.label.includes("Extremely High")) acc[r.crop].highRisk += r.total;
        return acc;
      }, {}),
    ).map(([cropName, values]) => ({
      cropName,
      total: values.total,
      riskShare: values.total > 0 ? Math.round((values.highRisk / values.total) * 100) : 0,
    }));

    const maxProduction = Math.max(...grouped.map((d) => d.total), 1);
    const minProduction = Math.min(...grouped.map((d) => d.total), 0);

    return (
      <div className="space-y-4">
        <div className="relative h-80 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="absolute inset-y-4 left-12 border-l border-dashed border-slate-300" />
          <div className="absolute inset-x-4 bottom-12 border-t border-dashed border-slate-300" />
          <div className="absolute left-3 top-3 text-xs font-medium text-slate-500">High risk share (%)</div>
          <div className="absolute bottom-3 right-4 text-xs font-medium text-slate-500">Production (MT)</div>

          {grouped.map((point) => {
            const x = maxProduction === minProduction ? 50 : ((point.total - minProduction) / (maxProduction - minProduction)) * 78 + 12;
            const y = 88 - point.riskShare * 0.76;
            return (
              <div key={point.cropName} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
                <div className="group relative flex flex-col items-center">
                  <div className="h-4 w-4 rounded-full border-2 border-white bg-blue-500 shadow" />
                  <div className="mt-2 text-xs font-medium text-slate-700">{point.cropName}</div>
                  <div className="pointer-events-none absolute bottom-full mb-2 hidden whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg group-hover:block">
                    <div className="font-semibold">{point.cropName}</div>
                    <div>{point.total.toLocaleString()} MT production</div>
                    <div>{point.riskShare}% under high risk</div>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="absolute left-4 bottom-14 text-[10px] text-slate-400">0%</div>
          <div className="absolute left-4 top-10 text-[10px] text-slate-400">100%</div>
          <div className="absolute left-12 bottom-4 text-[10px] text-slate-400">Low production</div>
          <div className="absolute right-4 bottom-4 text-[10px] text-slate-400">High production</div>
        </div>
        <div className="grid grid-cols-1 gap-2 text-xs text-slate-600 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">Top-right = highest priority hotspots</div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">Bottom-right = large volume, lower risk</div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">Top-left = smaller volume, higher-risk niche crops</div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-[1400px]">
        <div className="grid max-w-xl grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-indigo-50 p-2">
          {[
            { id: "aqueduct", label: "Aqueduct (existing)" },
            { id: "food", label: "Food (existing)" },
            { id: "asc", label: "Agricultural Supply Chain Analyzer" },
          ].map((tab) => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id as typeof activeTab)} className={cx("rounded-xl border px-3 py-2 text-sm", activeTab === tab.id ? "border-slate-200 bg-white text-slate-900 shadow-sm" : "border-transparent text-slate-600")}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "asc" && (
          <div className="mt-6 grid min-h-[900px] gap-6 items-start" style={{ gridTemplateColumns: "45% 55%" }}>
            <div className="min-w-0 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><SmallIcon>📍</SmallIcon>Locations & Inputs</CardTitle>
                  <CardDescription>Add your locations to generate water risk analyses. Upload them from a file or add manually. <span className="font-medium">Supports up to 500 locations.</span></CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm text-slate-500">Add locations manually or quickly import from a file.</div>
                    <div className="flex items-center gap-2">
                      <button type="button" className={cx("rounded-lg border px-3 py-2 text-sm", inputMode === "manual" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700")} onClick={() => setInputMode("manual")}>Add manually</button>
                      <button type="button" className={cx("rounded-lg border px-3 py-2 text-sm", inputMode === "quick" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700")} onClick={() => setInputMode("quick")}>Quick import</button>
                    </div>
                  </div>

                  {inputMode === "quick" && (
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-3">
                      <input
                        id="asc-file"
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const f = (e.target as HTMLInputElement).files?.[0];
                          setImportFileName(f ? f.name : "");
                          setImportFile(f || null);
                        }}
                      />
                      <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" onClick={() => document.getElementById("asc-file")?.click()}>Choose file</button>
                      <span className="max-w-[26ch] truncate text-sm text-slate-600">{importFileName || "No file selected"}</span>
                      <button type="button" disabled={!importFile} className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50" onClick={() => alert("Import not implemented in this mock.")}>Import file</button>
                      <button type="button" className="ml-auto text-sm text-blue-600 underline" onClick={downloadTemplate}>Download template</button>
                    </div>
                  )}

                  {inputMode === "manual" && (
                    <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <FieldLabel>Location type</FieldLabel>
                        <SelectInput
                          value={locationType}
                          onChange={(e) => {
                            const next = e.target.value as LocationType;
                            setLocationType(next);
                            if (next === "Coordinates") {
                              setLocation("");
                              setSelectedState("");
                            } else {
                              setLatitude("");
                              setLongitude("");
                            }
                          }}
                        >
                          <option value="Coordinates">Coordinates</option>
                          <option value="Country">Country</option>
                        </SelectInput>
                      </div>

                      {locationType === "Coordinates" ? (
                        <div className="md:col-span-2 grid grid-cols-2 gap-3">
                          <div>
                            <FieldLabel>Latitude</FieldLabel>
                            <Input placeholder="e.g., 35.5" value={latitude} onChange={(e) => setLatitude(e.target.value)} />
                          </div>
                          <div>
                            <FieldLabel>Longitude</FieldLabel>
                            <Input placeholder="e.g., 70.5" value={longitude} onChange={(e) => setLongitude(e.target.value)} />
                          </div>
                        </div>
                      ) : (
                        <div className="md:col-span-2">
                          <FieldLabel>Location</FieldLabel>
                          <SelectInput value={location} onChange={(e) => { setLocation(e.target.value); setSelectedState(""); }}>
                            <option value="">Select country</option>
                            {COUNTRY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                          </SelectInput>
                        </div>
                      )}

                      {locationType === "Country" && (
                        <div>
                          <FieldLabel>State</FieldLabel>
                          <SelectInput value={selectedState} onChange={(e) => setSelectedState(e.target.value)} disabled={location !== "Brazil"}>
                            <option value="">{location === "Brazil" ? "Select state" : "Select country first"}</option>
                            {location === "Brazil" && BRAZIL_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </SelectInput>
                        </div>
                      )}

                      {locationType === "Coordinates" && (
                        <div>
                          <FieldLabel>Radius (km)</FieldLabel>
                          <Input value={bufferKm} onChange={(e) => setBufferKm(e.target.value)} />
                        </div>
                      )}

                      <div>
                        <FieldLabel>Crop</FieldLabel>
                        <SelectInput value={crop} onChange={(e) => setCrop(e.target.value)}>
                          {CROPS.map((c) => <option key={c} value={c}>{c}</option>)}
                        </SelectInput>
                      </div>

                      <div>
                        <FieldLabel>Irrigation</FieldLabel>
                        <SelectInput value={irrigation} onChange={(e) => setIrrigation(e.target.value as Irrig)}>
                          {(["Rainfed", "Irrigated", "Mixed", "Unknown", "All"] as const).map((i) => <option key={i} value={i}>{i}</option>)}
                        </SelectInput>
                      </div>

                      <div>
                        <FieldLabel>Volume (MT/year)</FieldLabel>
                        <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                      </div>

                      <div className="md:col-span-2 flex justify-end">
                        <button type="button" className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white" onClick={addRow}>Add location</button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>Inputs Table</CardTitle>
                    <CardDescription>Preview of the locations that will be analyzed</CardDescription>
                  </div>
                  {statusBadge}
                </CardHeader>
                <CardContent>
                  <div className="max-h-64 overflow-auto rounded-xl border border-slate-200">
                    <table className="min-w-[780px] w-full text-sm">
                      <thead className="sticky top-0 bg-slate-50 text-left">
                        <tr>
                          <th className="border-b border-slate-200 px-3 py-2">Location</th>
                          <th className="border-b border-slate-200 px-3 py-2">Radius</th>
                          <th className="border-b border-slate-200 px-3 py-2">Crop</th>
                          <th className="border-b border-slate-200 px-3 py-2">Irrigation</th>
                          <th className="border-b border-slate-200 px-3 py-2">Volume (MT/year)</th>
                          <th className="border-b border-slate-200 px-3 py-2">Indicator</th>
                          <th className="border-b border-slate-200 px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.length === 0 ? (
                          <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">No inputs yet.</td></tr>
                        ) : (
                          tableWithErrors.map((r) => (
                            <tr key={r.id} className="align-top">
                              <td className="border-b border-slate-100 px-3 py-2">{r.locationType === "Country" ? `Country: ${r.location}${r.state ? ` — State: ${r.state}` : ""}` : `Coordinates: ${r.latitude ?? ""}, ${r.longitude ?? ""}`}</td>
                              <td className="border-b border-slate-100 px-3 py-2">{r.bufferKm ? `${r.bufferKm} km` : "—"}</td>
                              <td className="border-b border-slate-100 px-3 py-2">{r.crop}</td>
                              <td className="border-b border-slate-100 px-3 py-2">{r.irrigation}</td>
                              <td className="border-b border-slate-100 px-3 py-2">{r.quantity}</td>
                              <td className="border-b border-slate-100 px-3 py-2">{r.riskIndicator}</td>
                              <td className="border-b border-slate-100 px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <Pill ok={!r.errors || Object.keys(r.errors).length === 0} />
                                  <button type="button" className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs" onClick={() => removeRow(r.id)}>Remove</button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-200 p-3">
                    <div className="text-sm font-semibold">Customize Analysis</div>
                    <div className="mt-1 text-xs text-slate-500">Choose one water risk analysis and how results should be reported. These settings apply to all locations in this run.</div>
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <FieldLabel>Water Risk Analysis</FieldLabel>
                        <div className="space-y-2">
                          {RISK_INDICATORS.map((ind) => {
                            const tip = INDICATOR_TOOLTIPS[ind];
                            return (
                              <label key={ind} className="flex items-start gap-2 text-sm">
                                <input type="radio" name="riskIndicator" className="mt-1" checked={selectedIndicator === ind} onChange={() => selectIndicator(ind)} />
                                <span className="flex-1 leading-snug">
                                  {ind}
                                  <button type="button" className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-100 text-[10px] text-slate-600" onMouseEnter={() => setHoveredTip(ind)} onMouseLeave={() => setHoveredTip((curr) => (curr === ind ? null : curr))} onFocus={() => setHoveredTip(ind)} onBlur={() => setHoveredTip((curr) => (curr === ind ? null : curr))}>i</button>
                                  {hoveredTip === ind && (
                                    <span className="mt-2 block max-w-xs rounded-lg border border-slate-200 bg-slate-900 px-3 py-2 text-xs text-white">
                                      <span className="block font-semibold">{tip.title}</span>
                                      <span className="mt-1 block text-slate-200">{tip.detail}</span>
                                    </span>
                                  )}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <FieldLabel>Report results by</FieldLabel>
                        <div className="space-y-2">
                          {AGGREGATION_OPTIONS.map((opt) => (
                            <label key={opt} className="flex items-center gap-2 text-sm">
                              <input type="radio" name="aggregationPreference" checked={aggregationPreference === opt} onChange={() => setAggregationPreference(opt)} />
                              {opt}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button type="button" disabled={!allValid || rows.length === 0 || status === "running"} className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50" onClick={runAnalysis}>Run analysis</button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Results</CardTitle>
                  <CardDescription>Same filtered dataset, shown in different ways.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-slate-200 p-3 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div>
                        <FieldLabel>Filter crops</FieldLabel>
                        <div className="w-[260px] rounded-lg border border-slate-200 bg-white p-2">
                          {availableResultCrops.length === 0 ? (
                            <div className="text-sm text-slate-400">Add crops in Inputs first</div>
                          ) : (
                            <div className="max-h-32 space-y-2 overflow-auto">
                              {availableResultCrops.map((c) => (
                                <label key={c} className="flex items-center gap-2 text-sm text-slate-700">
                                  <input type="checkbox" checked={chartCropFilters.includes(c)} onChange={(e) => setChartCropFilters((prev) => (e.target.checked ? [...prev, c] : prev.filter((item) => item !== c)))} />
                                  {c}
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">Filter by highest production:</span>
                        <input type="range" min={0} max={150000} step={1000} value={prodThreshold} onChange={(e) => setProdThreshold(Number(e.target.value))} className="w-56" />
                        <span className="text-sm tabular-nums">{prodThreshold.toLocaleString()} MT</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-xs text-slate-500">{sortKey ? `Sorting: ${sortKey === "total" ? "Total IFPRI" : "Disaggregated"} ${sortDir.toUpperCase()}` : "Sorting: Watershed ID ASC"}</div>
                        <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" onClick={resetResultsControls}>Reset</button>
                      </div>
                    </div>
                  </div>

                  <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                    {([
                      { id: "summary", label: "Results" },
                      { id: "table", label: "Table" },
                      { id: "charts", label: "Charts" },
                    ] as const).map((tab) => (
                      <button key={tab.id} type="button" onClick={() => setResultsView(tab.id)} className={cx("rounded-lg px-3 py-2 text-sm", resultsView === tab.id ? "border border-slate-200 bg-white text-slate-900 shadow-sm" : "text-slate-600")}>{tab.label}</button>
                    ))}
                  </div>

                  {resultsView === "summary" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                        <div className="rounded-xl border border-slate-200 p-3">
                          <div className="text-xs text-slate-500">Total Production</div>
                          <div className="text-lg font-semibold">{summaryMetrics.totalProduction.toLocaleString()} MT</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 p-3">
                          <div className="text-xs text-slate-500">Production Under High Risk</div>
                          <div className="text-lg font-semibold">{summaryMetrics.highRiskShare}%</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 p-3">
                          <div className="text-xs text-slate-500"># Locations</div>
                          <div className="text-lg font-semibold">{summaryMetrics.locationCount}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {resultsView === "table" && (
                    <div className="max-h-[560px] overflow-auto rounded-xl border border-slate-200">
                      <table className="min-w-[760px] w-full text-sm">
                        <thead className="sticky top-0 bg-slate-50 text-left">
                          <tr>
                            <th className="border-b border-slate-200 px-3 py-2">{aggregationPreference === "Watershed" ? "Watershed ID" : aggregationPreference}</th>
                            <th className="border-b border-slate-200 px-3 py-2">{aggregationPreference === "Crop" ? "Contributing Watersheds" : "Crop"}</th>
                            <th className="border-b border-slate-200 px-3 py-2"><button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("total")}>↕ Total IFPRI Production (MT)</button></th>
                            <th className="border-b border-slate-200 px-3 py-2"><button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("disagg")}>↕ Disaggregated Production (MT)</button></th>
                            <th className="border-b border-slate-200 px-3 py-2">Aqueduct Baseline Water Stress Range</th>
                            <th className="border-b border-slate-200 px-3 py-2">Aqueduct Baseline Water Stress Label</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedResults.length === 0 ? (
                            <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">No results match the current filter.</td></tr>
                          ) : (
                            displayedResults.map((r) => (
                              <tr key={`${aggregationPreference}-${r.groupKey}`}>
                                <td className="border-b border-slate-100 px-3 py-2">{aggregationPreference === "Watershed" ? r.watershedId : r.groupKey}</td>
                                <td className="border-b border-slate-100 px-3 py-2">{aggregationPreference === "Crop" ? r.watershedId : r.crop}</td>
                                <td className="border-b border-slate-100 px-3 py-2">{r.total.toLocaleString()}</td>
                                <td className="border-b border-slate-100 px-3 py-2">{r.disagg.toLocaleString()}</td>
                                <td className="border-b border-slate-100 px-3 py-2">{r.range}</td>
                                <td className="border-b border-slate-100 px-3 py-2">{r.label}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {resultsView === "charts" && (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-slate-200 p-4">
                        <div className="mb-3 text-sm font-medium text-slate-900">High-Risk Hotspots</div>
                        {renderHotspots()}
                        <div className="mt-3 text-xs text-slate-500">Shows production under high and extremely high water risk, sorted by largest hotspots.</div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                        <div>
                          <FieldLabel>Region</FieldLabel>
                          <SelectInput value={chartRegionFilter} onChange={(e) => setChartRegionFilter(e.target.value)}>
                            <option value="all">All regions</option>
                            {availableRegions.map((region) => <option key={region} value={region}>{region}</option>)}
                          </SelectInput>
                        </div>
                        <div>
                          <FieldLabel>Business Unit</FieldLabel>
                          <SelectInput value={chartBusinessUnitFilter} onChange={(e) => setChartBusinessUnitFilter(e.target.value)}>
                            <option value="all">All business units</option>
                            {availableBusinessUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                          </SelectInput>
                        </div>
                        <div className="flex items-end text-xs text-slate-500">Production views filtered by region and business unit.</div>
                      </div>

                      <div className="rounded-xl border border-slate-200 p-4">
                        <div className="mb-3 text-sm font-medium text-slate-900">Total Production by Crop</div>
                        {renderTotalProduction()}
                      </div>

                      <div className="rounded-xl border border-slate-200 p-4">
                        <div className="mb-3 text-sm font-medium text-slate-900">Production by Crop and Risk Distribution</div>
                        {renderCropRiskDistribution()}
                      </div>

                      <div className="rounded-xl border border-slate-200 p-4">
                        <div className="mb-3 text-sm font-medium text-slate-900">Irrigation vs Risk</div>
                        {renderIrrigationRisk()}
                      </div>

                      <div className="rounded-xl border border-slate-200 p-4">
                        <div className="mb-3 text-sm font-medium text-slate-900">Production vs Risk</div>
                        {renderProductionVsRisk()}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button type="button" className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">Download results</button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="min-w-0">
              <Card className="sticky top-6 h-[calc(100vh-4rem)] min-h-[900px] w-full">
                <CardHeader>
                  <CardTitle>Map Visualization</CardTitle>
                  <CardDescription>Illustrative map + legend</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex h-[540px] w-full items-center justify-center rounded-xl border border-slate-200 bg-gradient-to-r from-blue-200 to-green-200">
                    <span className="text-slate-600">[Map Placeholder]</span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                    <div className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-red-500" />Extremely High</div>
                    <div className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-orange-400" />High</div>
                    <div className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-yellow-300" />Medium</div>
                    <div className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-green-300" />Low</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function __runInlineTests() {
  const good: Row = {
    id: "t1",
    locationType: "Country",
    location: "Brazil",
    state: "São Paulo",
    bufferKm: "25",
    crop: "Maize",
    irrigation: "Rainfed",
    quantity: "1000",
    riskIndicator: "WRI-Aqueduct Food Analysis",
  };
  const countryOnly: Row = {
    id: "t1b",
    locationType: "Country",
    location: "Brazil",
    bufferKm: "",
    crop: "Soybean",
    irrigation: "Rainfed",
    quantity: "250",
    riskIndicator: "WRI-Aqueduct Food Analysis",
  };
  const coordGood: Row = {
    id: "t2",
    locationType: "Coordinates",
    location: "35.5, 70.5",
    latitude: "35.5",
    longitude: "70.5",
    bufferKm: "10",
    crop: "Wheat",
    irrigation: "All",
    quantity: "10",
    riskIndicator: "WRI-Aqueduct Food Analysis",
  };
  const badBuf: Row = { ...good, id: "t3", bufferKm: "0" };
  const badQty: Row = { ...good, id: "t4", quantity: "0" };
  const badCoordParen: Row = {
    id: "t5",
    locationType: "Coordinates",
    location: "(35.5, 70.5)",
    latitude: "(35.5",
    longitude: "70.5)",
    bufferKm: "10",
    crop: "Wheat",
    irrigation: "All",
    quantity: "10",
    riskIndicator: "WRI-Aqueduct Food Analysis",
  };
  const missingIndicator: Row = { ...good, id: "t6", riskIndicator: "" };
  const missingLat: Row = { ...coordGood, id: "t2b", latitude: "", location: ", 70.5" };
  const cropRows: Row[] = [
    { ...good, id: "c1", crop: "Maize" },
    { ...good, id: "c2", crop: "Wheat" },
    { ...good, id: "c3", crop: "Maize" },
  ];
  const uniqueCrops = Array.from(new Set(cropRows.map((r) => r.crop)));

  console.assert(Object.keys(validateRow(good)).length === 0, "good row valid");
  console.assert(Object.keys(validateRow(countryOnly)).length === 0, "country-only row valid");
  console.assert(Object.keys(validateRow(coordGood)).length === 0, "coords valid");
  console.assert(!!validateRow(missingLat).latitude, "latitude required for coordinates");
  console.assert(!!validateRow(badBuf).bufferKm, "radius must be > 0 when provided");
  console.assert(!!validateRow(badQty).quantity, "volume must be > 0");
  console.assert(!!validateRow(badCoordParen).latitude || !!validateRow(badCoordParen).longitude, "invalid coord fields rejected");
  console.assert(!!validateRow(missingIndicator).riskIndicator, "must select one indicator");
  console.assert(AGGREGATION_OPTIONS.includes("Watershed"), "aggregation options include Watershed");
  console.assert(uniqueCrops.length === 2, "unique crop options derived from input rows");

  const metricsRows: ResultRow[] = [
    { watershedId: 1, crop: "Maize", businessUnit: "Cereals", region: "South America", irrigation: "Irrigated", total: 100, disagg: 10, range: "40–80%", label: "High (40–80%)" },
    { watershedId: 2, crop: "Wheat", businessUnit: "Cereals", region: "South America", irrigation: "Rainfed", total: 50, disagg: 5, range: "20–40%", label: "Medium to High (20–40%)" },
  ];
  const metricsTotal = metricsRows.reduce((sum, r) => sum + r.total, 0);
  const metricsHighProduction = metricsRows.filter((r) => r.label.includes("High (40–80%)") || r.label.includes("Extremely High")).reduce((sum, r) => sum + r.total, 0);
  const metricsHighShare = Math.round((metricsHighProduction / metricsTotal) * 100);
  console.assert(metricsTotal === 150, "summary total production is aggregated from filtered results");
  console.assert(metricsHighShare === 67, "summary high risk share is production-weighted");

  const cropGrouped = Object.values(metricsRows.reduce<Record<string, number>>((acc, r) => {
    acc[r.crop] = (acc[r.crop] || 0) + r.total;
    return acc;
  }, {}));
  console.assert(cropGrouped.length === 2, "results can be grouped by crop when aggregation changes");

  const productionByCrop = Object.entries(metricsRows.reduce<Record<string, number>>((acc, r) => {
    acc[r.crop] = (acc[r.crop] || 0) + r.total;
    return acc;
  }, {}));
  console.assert(productionByCrop.length === 2, "chart data can be grouped by crop for total production view");

  const totalProductionForChart = productionByCrop.reduce((sum, [, value]) => sum + value, 0);
  const maizeShare = Math.round((productionByCrop[0][1] / totalProductionForChart) * 100);
  console.assert(maizeShare > 0, "total production chart computes share values without ReferenceError");

  const mixedRiskRows: ResultRow[] = [
    { watershedId: 10, crop: "Maize", businessUnit: "Cereals", region: "South America", irrigation: "Rainfed", total: 25, disagg: 2, range: "0–10%", label: "Low (<10%)" },
    { watershedId: 11, crop: "Maize", businessUnit: "Cereals", region: "South America", irrigation: "Mixed", total: 35, disagg: 3, range: "40–80%", label: "High (40–80%)" },
    { watershedId: 12, crop: "Maize", businessUnit: "Cereals", region: "South America", irrigation: "Irrigated", total: 40, disagg: 4, range: "> 100%", label: "Extremely High (>80%)" },
  ];
  const riskDistributionByCrop = mixedRiskRows.reduce<Record<string, { low: number; high: number; extreme: number }>>((acc, r) => {
    if (!acc[r.crop]) acc[r.crop] = { low: 0, high: 0, extreme: 0 };
    if (r.label.includes("Low")) acc[r.crop].low += r.total;
    if (r.label.includes("High (40–80%)")) acc[r.crop].high += r.total;
    if (r.label.includes("Extremely High")) acc[r.crop].extreme += r.total;
    return acc;
  }, {});
  console.assert(riskDistributionByCrop.Maize.low === 25, "risk chart keeps low share for same crop");
  console.assert(riskDistributionByCrop.Maize.high === 35, "risk chart keeps high share for same crop");
  console.assert(riskDistributionByCrop.Maize.extreme === 40, "risk chart keeps extreme share for same crop");

  const irrigationRisk = mixedRiskRows.reduce<Record<string, number>>((acc, r) => {
    acc[r.irrigation] = (acc[r.irrigation] || 0) + r.total;
    return acc;
  }, {});
  console.assert(irrigationRisk.Rainfed === 25, "irrigation chart groups rainfed production");
  console.assert(irrigationRisk.Mixed === 35, "irrigation chart groups mixed production");
  console.assert(irrigationRisk.Irrigated === 40, "irrigation chart groups irrigated production");

  const scatterRows: ResultRow[] = [
    { watershedId: 20, crop: "Maize", businessUnit: "Cereals", region: "South America", irrigation: "Rainfed", total: 60, disagg: 1, range: "40–80%", label: "High (40–80%)" },
    { watershedId: 21, crop: "Maize", businessUnit: "Cereals", region: "South America", irrigation: "Irrigated", total: 40, disagg: 1, range: "0–10%", label: "Low (<10%)" },
    { watershedId: 22, crop: "Rice", businessUnit: "Staples", region: "Asia", irrigation: "Irrigated", total: 30, disagg: 1, range: "> 100%", label: "Extremely High (>80%)" },
  ];
  const scatterGrouped = Object.entries(
    scatterRows.reduce<Record<string, { total: number; highRisk: number }>>((acc, r) => {
      if (!acc[r.crop]) acc[r.crop] = { total: 0, highRisk: 0 };
      acc[r.crop].total += r.total;
      if (r.label.includes("High (40–80%)") || r.label.includes("Extremely High")) acc[r.crop].highRisk += r.total;
      return acc;
    }, {}),
  ).map(([cropName, values]) => ({ cropName, total: values.total, riskShare: Math.round((values.highRisk / values.total) * 100) }));
  const maizePoint = scatterGrouped.find((d) => d.cropName === "Maize");
  console.assert(maizePoint?.total === 100, "scatter chart groups total production by crop");
  console.assert(maizePoint?.riskShare === 60, "scatter chart computes high-risk share by crop");
}

if (typeof window !== "undefined" && (window as any).__ASC_RUN_TESTS__) {
  try {
    __runInlineTests();
  } catch (e) {
    console.warn("Inline tests failed:", e);
  }
}
