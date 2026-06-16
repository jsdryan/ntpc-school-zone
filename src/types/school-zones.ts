export type SchoolLevel = "elementary" | "juniorHigh";

export type SchoolZoneRecord = {
  id: string;
  level: SchoolLevel;
  district: string;
  schoolName: string;
  basicArea: string;
  freeArea: string;
  notes: string;
  sourcePages: number[];
};

export type CitywideFreeSchool = {
  no: number;
  regionGroup: string;
  district: string;
  schoolName: string;
  notes: string;
};

export type SchoolZoneDataset = {
  level: SchoolLevel;
  label: string;
  schoolKind: string;
  metadata: {
    title: string;
    revision: string;
    entryAge: string;
    sourceFile: string;
  };
  districts: string[];
  schools: SchoolZoneRecord[];
  citywideFreeSchools: CitywideFreeSchool[];
};

export type SchoolZonePayload = {
  defaultLevel: SchoolLevel;
  levels: Record<SchoolLevel, SchoolZoneDataset>;
};
