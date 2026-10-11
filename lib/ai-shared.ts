// Shapes shared by the AI routes and the client components that call them.

export interface ReceiptFields {
  merchant: string | null;
  date: string | null;
  total: number | null;
  category: string | null;
  items: { name: string; amount: number }[];
}

export interface StatementResult {
  bank: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  rows: {
    date: string;
    description: string;
    direction: 'masuk' | 'keluar';
    amount: number;
    balanceAfter: number | null;
    category: string;
  }[];
  truncated: boolean;
}
