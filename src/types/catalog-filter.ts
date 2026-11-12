export interface FilterOption {
  id: string;
  name?: string;
  label: string;
  value: string;
  checked?: boolean;
  disabled?: boolean;
  hidden?: boolean;
}
export interface FilterChoiceGroup {
  id: string;
  label: string;
  type: 'checkbox' | 'radio';
  name: string;
  options: FilterOption[];
}
export interface FilterRangeGroup {
  id: string;
  label: string;
  type: 'range';
  min: number;
  max: number;
  step?: number;
  from?: number;
  to?: number;
  minName: string;
  maxName: string;
  disabled?: boolean;
  open?: boolean;
}
export type FilterGroup = FilterChoiceGroup | FilterRangeGroup;
