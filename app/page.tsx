"use client";

import React, { useMemo, useState } from "react";
import {
  ArrowUpDown,
  CheckCircle2,
  FileDown,
  Info,
  MapPin,
  PlayCircle,
  RotateCcw,
  Upload,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ===== Types & Constants =====
type LocationType = "Coordinates" | "Country";
type Irrig = "Rainfed" | "Irrigated" | "Mixed" | "Unknown" | "All";

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

type AggregationPreference = "Watershed" | "Crop" | "Business Unit";
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

type Row = {
  id: string;
  locationType: LocationType;
  location: string;
  state?: string;
  latitude?: string;
  longitude?: string;
  bufferKm: string;
  crop: (typeof CROPS)[number] | string;
  irrigation: Irrig;
  quantity: string;
  riskIndicators: (typeof RISK_INDICATORS)[number][];
  errors?: Partial<Record<keyof Omit<Row, "id" | "errors">, string>>;
};

// ===== Validation =====
const validateRow = (r: Row) => {
  const errors: Row["errors"] = {};

  if (!r.location) errors.location = "Required";

  if (r.locationType === "Coordinates") {
    if (!r.latitude) errors.latitude = "Required";
    if (!r.longitude) errors.longitude = "Required";

    const lat = Number(r.latitude);
    const lon = Number(r.longitude);

    if (r.latitude && (isNaN(lat) || lat < -90 || lat > 90)) {
      errors.latitude = "Latitude must be between -90 and 90";
    }
    if (r.longitude && (isNaN(lon) || lon < -180 || lon > 180)) {
      errors.longitude = "Longitude must be between -180 and 180";
    }
  }

  // Radius is optional
  if (r.bufferKm) {
    const b = Number(r.bufferKm);
    if (isNaN(b) || b <= 0 || b > 200) errors.bufferKm = "1–200 km";
  }

  if (!r.crop) errors.crop = "Required";

  if (!r.quantity) errors.quantity = "Required";
  const q = Number(r.quantity);
  if (isNaN(q) || q <= 0) errors.quantity = "> 0";

  if (!r.riskIndicators || r.riskIndicators.length === 0) {
    errors.riskIndicators = "Select at least one";
  }

  return errors;
};

// ===== UI helpers =====
const Pill = ({ ok }: { ok: boolean }) => (
  <div className={`flex items-center gap-1 ${ok ? "text-green-600" : "text-red-600"}`}>
    {ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
  </div>
);

export default function AgriculturalSupplyChainAnalyzerMock() {
  const [rows, setRows] = useState<Row[]>([]);

  // Manual entry fields
  const [locationType, setLocationType] = useState<LocationType>("Coordinates");
  const [location, setLocation] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [bufferKm, setBufferKm] = useState("25");
  const [crop, setCrop] = useState<string>("Maize");
  const [irrigation, setIrrigation] = useState<Irrig>("Rainfed");
  const [quantity, setQuantity] = useState("1000");

  // Global analysis controls
  const [selectedIndicators, setSelectedIndicators] = useState<(typeof RISK_INDICATORS)[number][]>([
    "WRI-Aqueduct Food Analysis",
  ]);
  const [aggregationPreference, setAggregationPreference] = useState<AggregationPreference>("Watershed");

  // Import UI
  const [inputMode, setInputMode] = useState<"manual" | "quick">("manual");
  const [importFileName, setImportFileName] = useState<string>("");
  const [importFile, setImportFile] = useState<File | null>(null);

  // Tabs + status
  const [activeTab, setActiveTab] = useState("asc");
  const [status, setStatus] = useState<"idle" | "validating" | "ready" | "error" | "running" | "done">(
    "idle",
  );

  const locationPlaceholder = useMemo(() => {
    switch (locationType) {
      case "Country":
        return "e.g., Brazil";
      default:
        return "Enter location";
    }
  }, [locationType]);

  // ===== Results controls (slider + sorting + reset) =====
  const [prodThreshold, setProdThreshold] = useState<number>(0);
  const [sortKey, setSortKey] = useState<"total" | "disagg" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  type ResultRow = {
    watershedId: number;
    crop: string;
    total: number;
    disagg: number;
    range: string;
    label: string;
  };

  const results: ResultRow[] = useMemo(
    () => [
      {
        watershedId: 774401,
        crop: "Wheat",
        total: 44836,
        disagg: 205.55,
        range: "> 100%",
        label: "Extremely High (>80%)",
      },
      {
        watershedId: 774402,
        crop: "Maize",
        total: 120000,
        disagg: 900.1,
        range: "40–80%",
        label: "High (40–80%)",
      },
      {
        watershedId: 774403,
        crop: "Rice",
        total: 50200,
        disagg: 450.0,
        range: "20–40%",
        label: "Medium to High (20–40%)",
      },
    ],
    [],
  );

  const filteredSortedResults = useMemo(() => {
    let arr = results.filter((r) => r.total >= prodThreshold);

    if (sortKey) {
      arr = [...arr].sort((a, b) =>
        sortDir === "asc" ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey],
      );
    } else {
      arr = [...arr].sort((a, b) => a.watershedId - b.watershedId);
    }

    return arr;
  }, [results, prodThreshold, sortKey, sortDir]);

  const toggleSort = (key: "total" | "disagg") => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("desc");
    } else {
      setSortDir((prev) => (prev === "desc" ? "asc" : "desc"));
    }
  };

  const resetResultsControls = () => {
    setProdThreshold(0);
    setSortKey(null);
    setSortDir("desc");
  };

  // ===== Inputs table state =====
  const tableWithErrors = useMemo(() => rows.map((r) => ({ ...r, errors: validateRow(r) })), [rows]);
  const allValid = useMemo(
    () => tableWithErrors.every((r) => !r.errors || Object.keys(r.errors).length === 0),
    [tableWithErrors],
  );

  const addRow = () => {
    const coordinateLocation = latitude && longitude ? `${latitude}, ${longitude}` : "";

    const r: Row = {
      id: crypto.randomUUID(),
      locationType,
      location: locationType === "Coordinates" ? coordinateLocation : location,
      state: locationType === "Country" ? selectedState : undefined,
      latitude: locationType === "Coordinates" ? latitude : undefined,
      longitude: locationType === "Coordinates" ? longitude : undefined,
      bufferKm,
      crop,
      irrigation,
      quantity,
      riskIndicators: selectedIndicators,
    };

    const errors = validateRow(r);
    setRows((prev) => [...prev, { ...r, errors }]);
    setStatus(Object.keys(errors).length ? "error" : "ready");
  };

  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  const runAnalysis = () => {
    if (!allValid || rows.length === 0) {
      setStatus("error");
      return;
    }
    setStatus("running");
    setTimeout(() => setStatus("done"), 700);
  };

  const createTemplateCSV = () => {
    const header = [
      "Location",
      "Radius (km)",
      "Crop",
      "Irrigation",
      "Volume (MT/year)",
      "Indicator",
    ].join(",");
    const example = [
      "35.5, 70.5",
      "10",
      "Wheat",
      "All",
      "10",
      "WRI-Aqueduct Food Analysis",
    ].join(",");
    return [header, example].join("\n");
  };

  const downloadTemplate = () => {
    const csv = createTemplateCSV();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "asc-analyzer-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusBadge = () => {
    switch (status) {
      case "ready":
        return <Badge className="bg-emerald-600 hover:bg-emerald-700">Ready</Badge>;
      case "error":
        return <Badge variant="destructive">Fix inputs</Badge>;
      case "running":
        return <Badge className="bg-blue-600 hover:bg-blue-700">Analyzing…</Badge>;
      case "done":
        return <Badge className="bg-emerald-700">Results ready</Badge>;
      default:
        return <Badge>Idle</Badge>;
    }
  };

  const toggleIndicator = (ind: (typeof RISK_INDICATORS)[number], checked: boolean) => {
    setSelectedIndicators((prev) => (checked ? [...prev, ind] : prev.filter((p) => p !== ind)));

    setRows((prev) =>
      prev.map((rr) => {
        const nextIndicators = checked
          ? rr.riskIndicators.includes(ind)
            ? rr.riskIndicators
            : [...rr.riskIndicators, ind]
          : rr.riskIndicators.filter((p) => p !== ind);

        const updated: Row = { ...rr, riskIndicators: nextIndicators };
        return { ...updated, errors: validateRow(updated) };
      }),
    );
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 max-w-xl">
            <TabsTrigger value="aqueduct">Aqueduct (existing)</TabsTrigger>
            <TabsTrigger value="food">Food (existing)</TabsTrigger>
            <TabsTrigger value="asc">Agricultural Supply Chain Analyzer</TabsTrigger>
          </TabsList>

          <TabsContent value="asc" className="mt-6">
            <div className="grid grid-cols-2 gap-6 items-start">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Locations & Inputs
                    </CardTitle>
                    <CardDescription>
                      Add your locations to generate water risk analyses. Upload them from a file or add manually.{" "}
                      <span className="font-medium">Supports up to 500 locations.</span>
                    </CardDescription>
                  </CardHeader>

                  <CardContent>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="text-sm text-muted-foreground">
                        Add locations manually or quickly import from a file.
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Button
                          variant={inputMode === "manual" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setInputMode("manual")}
                        >
                          Add manually
                        </Button>
                        <Button
                          variant={inputMode === "quick" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setInputMode("quick")}
                        >
                          Quick import
                        </Button>
                      </div>
                    </div>

                    <div
                      className={
                        inputMode === "quick" ? "rounded-md border p-3 flex flex-wrap items-center gap-2" : "hidden"
                      }
                    >
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById("asc-file")?.click()}
                      >
                        Choose file
                      </Button>
                      <span className="text-sm truncate max-w-[40ch]">{importFileName || "No file selected"}</span>
                      <Button size="sm" disabled={!importFile} onClick={() => alert("Import not implemented in this mock.")}>
                        Import file
                      </Button>
                      <div className="ml-auto">
                        <Button
                          variant="link"
                          size="sm"
                          className="px-0 h-auto text-blue-600 hover:underline"
                          onClick={downloadTemplate}
                        >
                          <Upload className="mr-1 h-3 w-3" /> Download template
                        </Button>
                      </div>
                    </div>

                    <div className={inputMode === "manual" ? "grid grid-cols-1 md:grid-cols-2 gap-3" : "hidden"}>
                      <div>
                        <Label className="text-xs">Location type</Label>
                        <Select
                          value={locationType}
                          onValueChange={(v: string) => {
                            const next = v as LocationType;
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
                          <SelectTrigger className="w-full h-9 text-sm">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Coordinates">Coordinates</SelectItem>
                            <SelectItem value="Country">Country</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {locationType === "Coordinates" ? (
                        <div className="md:col-span-2 grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Latitude</Label>
                            <Input
                              className="w-full h-9 text-sm"
                              placeholder="e.g., 35.5"
                              value={latitude}
                              onChange={(e) => setLatitude(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Longitude</Label>
                            <Input
                              className="w-full h-9 text-sm"
                              placeholder="e.g., 70.5"
                              value={longitude}
                              onChange={(e) => setLongitude(e.target.value)}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="md:col-span-2">
                          <Label className="text-xs">Location</Label>
                          <Select
                            value={location}
                            onValueChange={(v: string) => {
                              setLocation(v);
                              setSelectedState("");
                            }}
                          >
                            <SelectTrigger className="w-full h-9 text-sm">
                              <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                            <SelectContent>
                              {COUNTRY_OPTIONS.map((c) => (
                                <SelectItem key={c} value={c}>
                                  {c}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {locationType === "Country" && (
                        <div>
                          <Label className="text-xs">State</Label>
                          <Select value={selectedState} onValueChange={(v: string) => setSelectedState(v)}>
                            <SelectTrigger className="w-full h-9 text-sm">
                              <SelectValue placeholder={location === "Brazil" ? "Select state" : "Select country first"} />
                            </SelectTrigger>
                            <SelectContent>
                              {location === "Brazil" ? (
                                BRAZIL_STATES.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {s}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="__disabled" disabled>
                                  Select Brazil first
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {locationType === "Coordinates" && (
                        <div>
                          <Label className="text-xs">Radius (km)</Label>
                          <Input
                            className="w-full h-9 text-sm"
                            value={bufferKm}
                            onChange={(e) => setBufferKm(e.target.value)}
                          />
                        </div>
                      )}

                      <div>
                        <Label className="text-xs">Crop</Label>
                        <Select value={crop} onValueChange={(v: string) => setCrop(v)}>
                          <SelectTrigger className="w-full h-9 text-sm">
                            <SelectValue placeholder="Select crop" />
                          </SelectTrigger>
                          <SelectContent>
                            {(CROPS as readonly string[]).map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-xs">Irrigation</Label>
                        <Select value={irrigation} onValueChange={(v: string) => setIrrigation(v as Irrig)}>
                          <SelectTrigger className="w-full h-9 text-sm">
                            <SelectValue placeholder="Select irrigation" />
                          </SelectTrigger>
                          <SelectContent>
                            {(["Rainfed", "Irrigated", "Mixed", "Unknown", "All"] as const).map((i) => (
                              <SelectItem key={i} value={i}>
                                {i}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-xs">Volume (MT/year)</Label>
                        <Input
                          className="w-full h-9 text-sm"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                        />
                      </div>

                      <div className="md:col-span-2 flex justify-end">
                        <Button size="sm" onClick={addRow}>
                          Add location
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex items-start justify-between">
                    <div>
                      <CardTitle>Inputs Table</CardTitle>
                      <CardDescription>Preview of the locations that will be analyzed</CardDescription>
                    </div>
                    {statusBadge()}
                  </CardHeader>

                  <CardContent>
                    <div className="rounded-md border overflow-x-auto overflow-y-auto max-h-64 relative">
                      <Table className="min-w-[780px] text-sm">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Location</TableHead>
                            <TableHead>Radius</TableHead>
                            <TableHead>Crop</TableHead>
                            <TableHead>Irrigation</TableHead>
                            <TableHead>Volume (MT/year)</TableHead>
                            <TableHead>Indicators</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>

                        <TableBody>
                          {rows.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center text-muted-foreground">
                                No inputs yet.
                              </TableCell>
                            </TableRow>
                          ) : (
                            tableWithErrors.map((r) => (
                              <TableRow key={r.id}>
                                <TableCell>
                                  {r.locationType === "Country"
                                    ? `Country: ${r.location}${r.state ? ` — State: ${r.state}` : ""}`
                                    : `Coordinates: ${r.latitude ?? ""}, ${r.longitude ?? ""}`}
                                </TableCell>
                                <TableCell>{r.bufferKm ? `${r.bufferKm} km` : "—"}</TableCell>
                                <TableCell>{r.crop}</TableCell>
                                <TableCell>{r.irrigation}</TableCell>
                                <TableCell>{r.quantity}</TableCell>
                                <TableCell>{r.riskIndicators.join(", ")}</TableCell>
                                <TableCell className="flex items-center gap-2">
                                  <Pill ok={!r.errors || Object.keys(r.errors).length === 0} />
                                  <Button size="sm" variant="secondary" onClick={() => removeRow(r.id)}>
                                    Remove
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="mt-4 rounded-md border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">Customize Analysis</div>
                          <div className="text-xs text-muted-foreground">
                            Choose one or more water risk indicators and how results should be reported. These settings apply
                            to all locations in this run.
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Water Risk Indicators</Label>
                          <div className="space-y-2 mt-2">
                            {RISK_INDICATORS.map((ind) => {
                              const tip = INDICATOR_TOOLTIPS[ind];
                              return (
                                <label key={ind} className="flex items-start gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    className="mt-0.5"
                                    checked={selectedIndicators.includes(ind)}
                                    onChange={(e) => toggleIndicator(ind, e.target.checked)}
                                  />
                                  <span className="flex-1 leading-snug">
                                    {ind}
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          className="ml-1 inline-flex align-middle text-muted-foreground hover:text-foreground"
                                          aria-label={`Source info for ${ind}`}
                                        >
                                          <Info className="h-3.5 w-3.5" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs">
                                        <div className="text-xs font-semibold">{tip.title}</div>
                                        <div className="text-xs text-muted-foreground mt-1">{tip.detail}</div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs">Report results by</Label>
                          <div className="space-y-2 mt-2">
                            {AGGREGATION_OPTIONS.map((opt) => (
                              <label key={opt} className="flex items-center gap-2 text-sm">
                                <input
                                  type="radio"
                                  name="aggregationPreference"
                                  checked={aggregationPreference === opt}
                                  onChange={() => setAggregationPreference(opt)}
                                />
                                {opt}
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-4">
                      <Button disabled={!allValid || rows.length === 0 || status === "running"} onClick={runAnalysis}>
                        <PlayCircle className="mr-2 h-4 w-4" />
                        Run analysis
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Results</CardTitle>
                    <CardDescription>Outputs from the analysis (reported by {aggregationPreference})</CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <label className="text-sm font-medium">Filter by highest production:</label>
                        <input
                          type="range"
                          min={0}
                          max={150000}
                          step={1000}
                          value={prodThreshold}
                          onChange={(e) => setProdThreshold(Number(e.target.value))}
                          className="w-56"
                        />
                        <span className="text-sm tabular-nums">{prodThreshold.toLocaleString()} MT</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-xs text-muted-foreground">
                          {sortKey
                            ? `Sorting: ${sortKey === "total" ? "Total IFPRI" : "Disaggregated"} ${sortDir.toUpperCase()}`
                            : "Sorting: Watershed ID ASC"}
                        </div>
                        <Button variant="outline" size="sm" onClick={resetResultsControls}>
                          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-md border overflow-x-auto overflow-y-auto max-h-64 relative">
                      <Table className="min-w-[760px] text-sm">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Watershed ID</TableHead>
                            <TableHead>Crop</TableHead>
                            <TableHead>
                              <button className="inline-flex items-center gap-1" onClick={() => toggleSort("total")}>
                                <ArrowUpDown className="h-3.5 w-3.5" /> Total IFPRI Production (MT)
                              </button>
                            </TableHead>
                            <TableHead>
                              <button className="inline-flex items-center gap-1" onClick={() => toggleSort("disagg")}>
                                <ArrowUpDown className="h-3.5 w-3.5" /> Disaggregated Production (MT)
                              </button>
                            </TableHead>
                            <TableHead>Aqueduct Baseline Water Stress Range</TableHead>
                            <TableHead>Aqueduct Baseline Water Stress Label</TableHead>
                          </TableRow>
                        </TableHeader>

                        <TableBody>
                          {filteredSortedResults.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-muted-foreground">
                                No results match the current filter.
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredSortedResults.map((r) => (
                              <TableRow key={r.watershedId}>
                                <TableCell>{r.watershedId}</TableCell>
                                <TableCell>{r.crop}</TableCell>
                                <TableCell>{r.total.toLocaleString()}</TableCell>
                                <TableCell>{r.disagg.toLocaleString()}</TableCell>
                                <TableCell>{r.range}</TableCell>
                                <TableCell>{r.label}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="flex justify-end">
                      <Button>
                        <FileDown className="mr-2 h-4 w-4" />
                        Download results
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div>
                <Card className="h-full sticky top-6">
                  <CardHeader>
                    <CardTitle>Map Visualization</CardTitle>
                    <CardDescription>Illustrative map + legend</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center justify-center space-y-3">
                    <div className="h-[540px] w-full bg-gradient-to-r from-blue-200 to-green-200 rounded-md flex items-center justify-center">
                      <span className="text-slate-600">[Map Placeholder]</span>
                    </div>
                    <div className="flex gap-4 text-xs text-slate-600">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-red-500" />Extremely High
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-orange-400" />High
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-yellow-300" />Medium
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-green-300" />Low
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}

// ===== Inline tests (enable via: window.__ASC_RUN_TESTS__ = true) =====
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
    riskIndicators: ["WRI-Aqueduct Food Analysis"],
  };

  const countryOnly: Row = {
    id: "t1b",
    locationType: "Country",
    location: "Brazil",
    bufferKm: "",
    crop: "Soybean",
    irrigation: "Rainfed",
    quantity: "250",
    riskIndicators: ["WRI-Aqueduct Food Analysis"],
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
    riskIndicators: ["WRI-Aqueduct Food Analysis"],
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
    riskIndicators: ["WRI-Aqueduct Food Analysis"],
  };

  const noIndicators: Row = { ...good, id: "t6", riskIndicators: [] };
  const missingLat: Row = { ...coordGood, id: "t2b", latitude: "", location: ", 70.5" };

  console.assert(Object.keys(validateRow(good)).length === 0, "good row valid");
  console.assert(Object.keys(validateRow(countryOnly)).length === 0, "country-only row valid");
  console.assert(Object.keys(validateRow(coordGood)).length === 0, "coords valid");
  console.assert(!!validateRow(missingLat).latitude, "latitude required for coordinates");
  console.assert(!!validateRow(badBuf).bufferKm, "radius must be > 0 when provided");
  console.assert(!!validateRow(badQty).quantity, "volume must be > 0");
  console.assert(
    !!validateRow(badCoordParen).latitude || !!validateRow(badCoordParen).longitude,
    "invalid coord fields rejected",
  );
  console.assert(!!validateRow(noIndicators).riskIndicators, "must select at least one indicator");
  console.assert(AGGREGATION_OPTIONS.includes("Watershed"), "aggregation options include Watershed");
}

if (typeof window !== "undefined" && (window as any).__ASC_RUN_TESTS__) {
  try {
    __runInlineTests();
  } catch (e) {
    console.warn("Inline tests failed:", e);
  }
}
