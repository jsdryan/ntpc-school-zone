"use client";

import {
  BookOpen,
  FileText,
  Info,
  ListFilter,
  MapPin,
  Search,
  School,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import type {
  CitywideFreeSchool,
  SchoolLevel,
  SchoolZonePayload,
  SchoolZoneRecord,
} from "@/types/school-zones";

type Mode = "all" | "free" | "citywide";

type SchoolZoneExplorerProps = {
  payload: SchoolZonePayload;
};

const modeLabels: Record<Mode, string> = {
  all: "各區學區",
  free: "有自由學區",
  citywide: "全市自由學區",
};

const levelLabels: Record<SchoolLevel, string> = {
  elementary: "國小",
  juniorHigh: "國中",
};

const schoolLevels: SchoolLevel[] = ["elementary", "juniorHigh"];

function normalize(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

function formatEntryAgeRange(value: string) {
  const match = value.match(
    /(\d+)年(\d+)月(\d+)日以後出生(?:至|及)(\d+)年(\d+)月(\d+)日以前出生/
  );

  if (!match) {
    return value;
  }

  const [, startYear, startMonth, startDay, endYear, endMonth, endDay] = match;
  const pad = (part: string) => part.padStart(2, "0");

  return `出生日期範圍：${startYear}/${pad(startMonth)}/${pad(
    startDay
  )} - ${endYear}/${pad(endMonth)}/${pad(endDay)}`;
}

function hasFreeArea(record: SchoolZoneRecord) {
  return (
    record.freeArea.trim().length > 0 ||
    record.notes.includes("自由學區") ||
    record.notes.includes("全市自由")
  );
}

function schoolSearchText(record: SchoolZoneRecord) {
  return normalize(
    [
      record.district,
      record.schoolName,
      record.basicArea,
      record.freeArea,
      record.notes,
    ].join(" ")
  );
}

function citywideSearchText(record: CitywideFreeSchool) {
  return normalize(
    [
      record.no.toString(),
      record.regionGroup,
      record.district,
      record.schoolName,
      record.notes,
    ].join(" ")
  );
}

function displayValue(value: string) {
  return value.trim() || "無";
}

function splitChineseNumberedText(value: string) {
  const normalized = displayValue(value).replace(
    /\s*([一二三四五六七八九十]+、)\s*/g,
    "\n$1"
  );

  return normalized
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function getHighlightRanges(value: string, query: string) {
  const term = normalize(query);

  if (!term) {
    return [];
  }

  const chars = Array.from(value);
  let normalizedText = "";
  const indexMap: number[] = [];

  chars.forEach((char, index) => {
    const normalizedChar = char
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\s+/g, "");

    for (let offset = 0; offset < normalizedChar.length; offset += 1) {
      normalizedText += normalizedChar[offset];
      indexMap.push(index);
    }
  });

  const ranges: Array<{ start: number; end: number }> = [];
  let searchFrom = 0;

  while (searchFrom < normalizedText.length) {
    const matchIndex = normalizedText.indexOf(term, searchFrom);

    if (matchIndex === -1) {
      break;
    }

    const start = indexMap[matchIndex];
    const lastIndex = indexMap[matchIndex + term.length - 1];

    if (start !== undefined && lastIndex !== undefined) {
      const end = lastIndex + 1;
      const previous = ranges[ranges.length - 1];

      if (previous && start <= previous.end) {
        previous.end = Math.max(previous.end, end);
      } else {
        ranges.push({ start, end });
      }
    }

    searchFrom = matchIndex + term.length;
  }

  return ranges;
}

function HighlightText({ text, query }: { text: string; query: string }) {
  const ranges = getHighlightRanges(text, query);

  if (ranges.length === 0) {
    return <>{text}</>;
  }

  const chars = Array.from(text);
  const parts: React.ReactNode[] = [];
  let cursor = 0;

  ranges.forEach((range, index) => {
    if (range.start > cursor) {
      parts.push(chars.slice(cursor, range.start).join(""));
    }

    parts.push(
      <mark
        key={`${range.start}-${range.end}-${index}`}
        className="bg-black px-1 text-white"
      >
        {chars.slice(range.start, range.end).join("")}
      </mark>
    );

    cursor = range.end;
  });

  if (cursor < chars.length) {
    parts.push(chars.slice(cursor).join(""));
  }

  return <>{parts}</>;
}

export default function SchoolZoneExplorer({
  payload,
}: SchoolZoneExplorerProps) {
  const [level, setLevel] = useState<SchoolLevel>(payload.defaultLevel);
  const [query, setQuery] = useState("");
  const [district, setDistrict] = useState("全部行政區");
  const [mode, setMode] = useState<Mode>("all");
  const [activeSchoolIds, setActiveSchoolIds] = useState<
    Record<SchoolLevel, string>
  >({
    elementary: payload.levels.elementary.schools[0]?.id ?? "",
    juniorHigh: payload.levels.juniorHigh.schools[0]?.id ?? "",
  });
  const [activeCitywideNos, setActiveCitywideNos] = useState<
    Record<SchoolLevel, number>
  >({
    elementary: payload.levels.elementary.citywideFreeSchools[0]?.no ?? 0,
    juniorHigh: payload.levels.juniorHigh.citywideFreeSchools[0]?.no ?? 0,
  });

  const dataset = payload.levels[level];
  const normalizedQuery = normalize(query);
  const availableModes: Mode[] =
    dataset.citywideFreeSchools.length > 0
      ? ["all", "free", "citywide"]
      : ["all", "free"];

  const filteredSchools = useMemo(() => {
    return dataset.schools.filter((record) => {
      if (district !== "全部行政區" && record.district !== district) {
        return false;
      }

      if (mode === "free" && !hasFreeArea(record)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return schoolSearchText(record).includes(normalizedQuery);
    });
  }, [dataset.schools, district, mode, normalizedQuery]);

  const filteredCitywide = useMemo(() => {
    return dataset.citywideFreeSchools.filter((record) => {
      if (district !== "全部行政區" && record.district !== district) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return citywideSearchText(record).includes(normalizedQuery);
    });
  }, [dataset.citywideFreeSchools, district, normalizedQuery]);

  const activeSchool =
    filteredSchools.find((record) => record.id === activeSchoolIds[level]) ??
    filteredSchools[0];
  const activeCitywide =
    filteredCitywide.find((record) => record.no === activeCitywideNos[level]) ??
    filteredCitywide[0];
  const showingCitywide =
    mode === "citywide" && dataset.citywideFreeSchools.length > 0;
  const resultCount = showingCitywide
    ? filteredCitywide.length
    : filteredSchools.length;

  function selectLevel(nextLevel: SchoolLevel) {
    setLevel(nextLevel);
    setDistrict("全部行政區");
    setMode("all");
  }

  function selectSchool(id: string) {
    setActiveSchoolIds((current) => ({ ...current, [level]: id }));
  }

  function selectCitywide(no: number) {
    setActiveCitywideNos((current) => ({ ...current, [level]: no }));
  }

  function resetFilters() {
    setQuery("");
    setDistrict("全部行政區");
    setMode("all");
  }

  return (
    <main className="min-h-screen bg-[#F7F7F8] text-[#111111]">
      <header className="border-b border-black bg-white">
        <section className="grid-paper min-h-[320px] p-6 sm:p-10">
          <div className="max-w-5xl">
            <div className="mb-10 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <span>{dataset.metadata.revision}</span>
              <span>{formatEntryAgeRange(dataset.metadata.entryAge)}</span>
            </div>
            <p className="mb-4 text-sm font-bold text-[#E4002B]">
              新北市公立{dataset.schoolKind}
            </p>
            <h1 className="max-w-4xl text-left text-5xl font-bold leading-[0.95] tracking-normal text-black sm:text-7xl lg:text-8xl">
              學區查詢
            </h1>
            <p className="mt-8 max-w-3xl text-base leading-7 sm:text-lg">
              {`依據「${dataset.metadata.title}」建立，支援以行政區、學校、里、鄰與自由學區關鍵字查詢。`}
            </p>
          </div>
        </section>
      </header>

      <section className="grid grid-cols-1 border-b border-black lg:h-[calc(100vh-320px)] lg:grid-cols-[320px_minmax(0,1fr)] lg:overflow-hidden">
        <aside className="bg-white p-5 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:border-r lg:p-6">
          <div className="space-y-6">
            <div>
              <p className="mb-2 text-sm font-bold">學制</p>
              <div className="grid grid-cols-2 border border-black">
                {schoolLevels.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`h-11 border-r border-black px-3 text-left text-sm last:border-r-0 ${
                      level === item
                        ? "bg-[#E4002B] font-bold text-white"
                        : "bg-white hover:bg-[#F7F7F8]"
                    }`}
                    onClick={() => selectLevel(item)}
                  >
                    {levelLabels[item]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                className="mb-2 block text-sm font-bold"
                htmlFor="school-zone-search"
              >
                搜尋
              </label>
              <div className="flex h-12 border border-black bg-white">
                <div className="grid w-12 place-items-center border-r border-black">
                  <Search aria-hidden="true" size={18} strokeWidth={1.8} />
                </div>
                <input
                  id="school-zone-search"
                  className="min-w-0 flex-1 px-3 text-base outline-none"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="輸入學校、里、鄰或行政區"
                />
                {query ? (
                  <button
                    type="button"
                    aria-label="清除搜尋"
                    className="grid w-12 place-items-center border-l border-black hover:bg-[#F7F7F8]"
                    onClick={() => setQuery("")}
                  >
                    <X aria-hidden="true" size={18} strokeWidth={1.8} />
                  </button>
                ) : null}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold" htmlFor="district">
                行政區
              </label>
              <select
                id="district"
                className="h-12 w-full border border-black bg-white px-3 text-base outline-none"
                value={district}
                onChange={(event) => setDistrict(event.target.value)}
              >
                <option>全部行政區</option>
                {dataset.districts.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold">資料範圍</p>
              <div className="grid border border-black">
                {availableModes.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`flex h-11 items-center justify-between border-b border-black px-3 text-left text-sm last:border-b-0 ${
                      mode === item
                        ? "bg-[#E4002B] font-bold text-white"
                        : "bg-white hover:bg-[#F7F7F8]"
                    }`}
                    onClick={() => setMode(item)}
                  >
                    <span>{modeLabels[item]}</span>
                    <ListFilter aria-hidden="true" size={16} strokeWidth={1.8} />
                  </button>
                ))}
              </div>
            </div>

            <FreeAreaExplainer />

            <button
              type="button"
              className="flex h-11 w-full items-center justify-center gap-2 border border-black bg-white text-sm font-bold hover:bg-[#F7F7F8]"
              onClick={resetFilters}
            >
              <X aria-hidden="true" size={16} strokeWidth={1.8} />
              清除
            </button>
          </div>
        </aside>

        <section className="min-w-0 lg:min-h-0">
          <div className="grid min-h-[calc(100vh-320px)] grid-cols-1 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_430px]">
            <div className="min-w-0 border-t border-black bg-[#F7F7F8] lg:flex lg:min-h-0 lg:flex-col lg:border-t-0 lg:border-r">
              <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-black bg-white px-5 py-4">
                <div>
                  <p className="text-sm font-bold">{modeLabels[mode]}</p>
                  <p className="text-sm">
                    {district}，符合條件 {resultCount} 筆
                  </p>
                </div>
                <div className="text-4xl font-bold leading-none text-[#E4002B] tabular-nums">
                  {String(resultCount).padStart(2, "0")}
                </div>
              </div>

              <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                {showingCitywide ? (
                  <CitywideList
                    records={filteredCitywide}
                    activeNo={activeCitywide?.no ?? 0}
                    onSelect={selectCitywide}
                    query={query}
                  />
                ) : (
                  <SchoolList
                    records={filteredSchools}
                    activeId={activeSchool?.id ?? ""}
                    onSelect={selectSchool}
                    query={query}
                  />
                )}
              </div>
            </div>

            <div className="hidden min-w-0 lg:block lg:h-full lg:min-h-0 lg:overflow-y-auto">
              <DetailPanel
                mode={mode}
                school={activeSchool}
                citywideSchool={activeCitywide}
                query={query}
              />
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function FreeAreaExplainer() {
  return (
    <section className="border border-black bg-[#F7F7F8]">
      <div className="flex items-center gap-2 border-b border-black bg-white px-3 py-2 text-sm font-bold">
        <Info aria-hidden="true" size={16} strokeWidth={1.8} />
        自由學區是什麼？
      </div>
      <div className="space-y-2 px-3 py-3 text-sm leading-6">
        <p>
          自由學區可以理解為「可選學校範圍」。住家所在的里、鄰如果列在自由學區內，家長可依公告列出的學校選擇申請，不只限一所基本學區學校。
        </p>
        <p className="font-bold text-[#E4002B]">
          是否能入學仍以當年度公告、戶籍資料與學校審查結果為準。
        </p>
      </div>
    </section>
  );
}

function SchoolList({
  records,
  activeId,
  onSelect,
  query,
}: {
  records: SchoolZoneRecord[];
  activeId: string;
  onSelect: (id: string) => void;
  query: string;
}) {
  if (records.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="divide-y divide-black">
      {records.map((record) => {
        const active = record.id === activeId;

        return (
          <div key={record.id}>
            <button
              type="button"
              aria-pressed={active}
              className={`w-full border-l-4 text-left ${
                active ? "bg-white" : "bg-[#F7F7F8] hover:bg-white"
              } ${active ? "border-l-[#E4002B]" : "border-l-transparent"}`}
              onClick={() => onSelect(record.id)}
            >
              <div className="min-w-0 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#E4002B]">
                      <HighlightText text={record.district} query={query} />
                    </p>
                    <h2 className="mt-1 text-2xl font-bold leading-tight">
                      <HighlightText text={record.schoolName} query={query} />
                    </h2>
                  </div>
                  {hasFreeArea(record) ? (
                    <span className="border border-black px-2 py-1 text-xs font-bold">
                      <HighlightText text="自由學區" query={query} />
                    </span>
                  ) : null}
                </div>
                <div className={active ? "hidden lg:block" : undefined}>
                  <SummaryText body={record.basicArea} query={query} />
                </div>
              </div>
            </button>
            {active ? (
              <div className="border-t border-black lg:hidden">
                <SchoolDetail record={record} query={query} compact />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function CitywideList({
  records,
  activeNo,
  onSelect,
  query,
}: {
  records: CitywideFreeSchool[];
  activeNo: number;
  onSelect: (no: number) => void;
  query: string;
}) {
  if (records.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="divide-y divide-black">
      {records.map((record) => {
        const active = record.no === activeNo;

        return (
          <div key={record.no}>
            <button
              type="button"
              aria-pressed={active}
              className={`grid w-full grid-cols-[74px_minmax(0,1fr)] text-left ${
                active ? "bg-white" : "bg-[#F7F7F8] hover:bg-white"
              }`}
              onClick={() => onSelect(record.no)}
            >
              <div
                className={`flex min-h-24 flex-col justify-between border-r border-black p-3 ${
                  active ? "bg-[#E4002B] text-white" : "bg-white text-black"
                }`}
              >
                <span className="text-xs font-bold">序號</span>
                <span className="text-3xl font-bold leading-none tabular-nums">
                  <HighlightText
                    text={String(record.no).padStart(2, "0")}
                    query={query}
                  />
                </span>
              </div>
              <div className="min-w-0 p-4">
                <p className="text-sm font-bold text-[#E4002B]">
                  <HighlightText
                    text={`${record.regionGroup} / ${record.district}`}
                    query={query}
                  />
                </p>
                <h2 className="mt-1 text-2xl font-bold leading-tight">
                  <HighlightText text={record.schoolName} query={query} />
                </h2>
              </div>
            </button>
            {active ? (
              <div className="border-t border-black lg:hidden">
                <CitywideDetail record={record} query={query} compact />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function DetailPanel({
  mode,
  school,
  citywideSchool,
  query,
}: {
  mode: Mode;
  school?: SchoolZoneRecord;
  citywideSchool?: CitywideFreeSchool;
  query: string;
}) {
  if (mode === "citywide") {
    return <CitywideDetail record={citywideSchool} query={query} />;
  }

  return <SchoolDetail record={school} query={query} />;
}

function SchoolDetail({
  record,
  query,
  compact = false,
}: {
  record?: SchoolZoneRecord;
  query: string;
  compact?: boolean;
}) {
  if (!record) {
    return <EmptyState />;
  }

  return (
    <aside className="bg-white lg:min-h-full">
      <div>
        {compact ? null : (
          <div className="border-b border-black p-5">
            <p className="flex items-center gap-2 text-sm font-bold text-[#E4002B]">
              <School aria-hidden="true" size={17} strokeWidth={1.8} />
              <HighlightText text={record.district} query={query} />
            </p>
            <h2 className="mt-3 text-4xl font-bold leading-none">
              <HighlightText text={record.schoolName} query={query} />
            </h2>
          </div>
        )}

        <TextBlock
          icon={<MapPin aria-hidden="true" size={17} strokeWidth={1.8} />}
          title="基本學區"
          body={record.basicArea}
          query={query}
        />
        <TextBlock
          icon={<BookOpen aria-hidden="true" size={17} strokeWidth={1.8} />}
          title="自由學區"
          body={record.freeArea}
          query={query}
        />
        {record.notes.trim() ? (
          <TextBlock
            icon={<FileText aria-hidden="true" size={17} strokeWidth={1.8} />}
            title="備註 / 調整說明"
            body={record.notes}
            query={query}
          />
        ) : null}
      </div>
    </aside>
  );
}

function CitywideDetail({
  record,
  query,
  compact = false,
}: {
  record?: CitywideFreeSchool;
  query: string;
  compact?: boolean;
}) {
  if (!record) {
    return <EmptyState />;
  }

  return (
    <aside className="bg-white lg:min-h-full">
      <div>
        {compact ? null : (
          <div className="border-b border-black p-5">
            <p className="flex items-center gap-2 text-sm font-bold text-[#E4002B]">
              <School aria-hidden="true" size={17} strokeWidth={1.8} />
              全市自由學區學校
            </p>
            <h2 className="mt-3 text-4xl font-bold leading-none">
              <HighlightText text={record.schoolName} query={query} />
            </h2>
            <p className="mt-4 text-sm tabular-nums">
              序號{" "}
              <HighlightText text={record.no.toString()} query={query} />
            </p>
          </div>
        )}

        <TextBlock
          icon={<MapPin aria-hidden="true" size={17} strokeWidth={1.8} />}
          title="行政區"
          body={`${record.regionGroup} / ${record.district}`}
          query={query}
        />
        {record.notes.trim() ? (
          <TextBlock
            icon={<FileText aria-hidden="true" size={17} strokeWidth={1.8} />}
            title="備註"
            body={record.notes}
            query={query}
          />
        ) : null}
      </div>
    </aside>
  );
}

function TextBlock({
  icon,
  title,
  body,
  query,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  query: string;
}) {
  const lines = splitChineseNumberedText(body);

  return (
    <section className="border-b border-black p-5">
      <h3 className="flex items-center gap-2 text-sm font-bold text-[#E4002B]">
        {icon}
        {title}
      </h3>
      <div className="mt-3 space-y-2 text-base leading-7">
        {lines.map((line, index) => (
          <NumberedLine key={`${line}-${index}`} line={line} query={query} />
        ))}
      </div>
    </section>
  );
}

function NumberedLine({ line, query }: { line: string; query: string }) {
  const match = line.match(/^([一二三四五六七八九十]+、)(.*)$/);

  if (!match) {
    return (
      <p>
        <HighlightText text={line} query={query} />
      </p>
    );
  }

  return (
    <p className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-1">
      <span>{match[1]}</span>
      <span>
        <HighlightText text={match[2].trim()} query={query} />
      </span>
    </p>
  );
}

function SummaryText({ body, query }: { body: string; query: string }) {
  const text = splitChineseNumberedText(body).join("\n");

  return (
    <p className="mt-3 line-clamp-2 whitespace-pre-line text-sm leading-6">
      <HighlightText text={text} query={query} />
    </p>
  );
}

function EmptyState() {
  return (
    <div className="grid min-h-80 place-items-start bg-white p-5">
      <div className="border border-black p-5">
        <p className="text-lg font-bold">沒有符合條件的資料</p>
        <p className="mt-2 text-sm">請調整搜尋字詞或行政區。</p>
      </div>
    </div>
  );
}
