'use client';

import { useRouter } from 'next/navigation';
import { fromRecord, type BaselineRecord } from '@/lib/baseline';
import { saveDraft } from '@/lib/draft';

/** Loads the saved baseline into the wizard so editing starts from what is stored, not from blank. */
export function EditBaselineButton({ record }: { record: BaselineRecord }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn btn-primary"
      onClick={() => {
        saveDraft({ ...fromRecord(record), reached: 6 });
        router.push('/mulai');
      }}
    >
      Perbarui kondisi awal
    </button>
  );
}
