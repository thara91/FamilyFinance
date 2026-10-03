import type { Metadata } from 'next';
import { Contact, LegalPage, List, Section } from '@/components/legal/LegalPage';
import { SITE } from '@/lib/site';

export const metadata: Metadata = { title: 'Kebijakan Privasi' };

export default function PrivacyPage() {
  return (
    <LegalPage title="Kebijakan Privasi" other={{ href: '/ketentuan', label: 'Syarat Layanan' }}>
      <p>
        Kebijakan ini menjelaskan data apa yang dikumpulkan {SITE.name}, untuk apa, di mana disimpan, dan hak Anda atas data tersebut sesuai
        Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi.
      </p>

      <Section id="pengelola" title="1. Pengelola">
        <p>{SITE.name} dikelola oleh {SITE.operatorName} sebagai pengendali data. Pertanyaan dan permintaan terkait data dikirim ke:</p>
        <Contact />
      </Section>

      <Section id="dikumpulkan" title="2. Data yang dikumpulkan">
        <List>
          <li>Alamat email, untuk mengirim tautan masuk dan mengenali akun Anda.</li>
          <li>Nama keluarga dan nama panggilan yang Anda isi.</li>
          <li>Nama, jenis, dan saldo rekening, e-wallet, reksa dana pasar uang, dan uang tunai, serta tanda mana yang menjadi penampung dana darurat.</li>
          <li>Pemasukan per bulan, pengeluaran per kategori, utang (sisa pokok dan cicilan), serta aset dan perkiraan nilainya.</li>
          <li>Status penghasilan (freelance, lajang, menikah, menikah dengan anak), target dana darurat, dan persentase alokasi bulanan.</li>
          <li>Cookie sesi yang dibuat saat Anda masuk, agar Anda tidak perlu masuk ulang di setiap halaman.</li>
        </List>
      </Section>

      <Section id="tidak" title="3. Yang tidak dikumpulkan">
        <List>
          <li>Nomor rekening, nomor kartu, PIN, atau kata sandi bank.</li>
          <li>Data mutasi rekening dari bank. Semua angka Anda isi sendiri.</li>
          <li>Pelacak iklan atau analitik pihak ketiga.</li>
        </List>
      </Section>

      <Section id="lokal" title="4. Isian sebelum disimpan">
        <p>
          Selama mengisi kondisi keuangan awal, isian disimpan di penyimpanan lokal browser pada perangkat Anda dan belum dikirim ke server. Isian
          baru dikirim saat Anda menekan Simpan dan masuk. Anda bisa menghapusnya kapan saja dengan tombol &quot;Kosongkan semua isian&quot;.
        </p>
      </Section>

      <Section id="tujuan" title="5. Tujuan dan dasar pemrosesan">
        <p>
          Data dipakai hanya untuk menghitung dan menampilkan ringkasan keuangan keluarga Anda (kekayaan bersih, arus kas, dana darurat, rasio
          cicilan) dan untuk mengirim tautan masuk. Dasar pemrosesannya adalah persetujuan yang Anda berikan saat masuk. Data tidak dijual dan
          tidak dipakai untuk iklan.
        </p>
      </Section>

      <Section id="simpan" title="6. Tempat penyimpanan dan pihak pemroses">
        <List>
          <li>Database dan layanan masuk: Supabase, di region {SITE.dataRegion}.</li>
          <li>Hosting aplikasi web: Vercel.</li>
        </List>
        <p>
          Setiap tabel dilindungi aturan akses di tingkat database, sehingga sebuah akun hanya bisa membaca data keluarga tempat ia terdaftar.
          Pengelola dapat mengakses database untuk pemeliharaan dan untuk menjalankan permintaan Anda.
        </p>
      </Section>

      <Section id="lama" title="7. Lama penyimpanan">
        <p>Data disimpan selama akun Anda aktif. Bila Anda meminta penghapusan akun, data keluarga yang Anda miliki ikut dihapus.</p>
      </Section>

      <Section id="hak" title="8. Hak Anda">
        <p>Anda berhak untuk:</p>
        <List>
          <li>mendapat informasi tentang pemrosesan data Anda;</li>
          <li>mengakses dan mendapat salinan data Anda;</li>
          <li>memperbaiki data yang tidak akurat, termasuk lewat tombol &quot;Perbarui kondisi awal&quot; di dashboard;</li>
          <li>meminta penghapusan data dan akun;</li>
          <li>menarik persetujuan pemrosesan.</li>
        </List>
        <p>Untuk menjalankan hak tersebut, kirim email ke kontak pada bagian 1 dari alamat email akun Anda.</p>
      </Section>

      <Section id="perubahan" title="9. Perubahan kebijakan">
        <p>
          Bila kebijakan ini berubah, tanggal berlaku di atas diperbarui dan perubahan penting diberitahukan lewat email akun. Baca juga halaman Syarat Layanan (tautan di bagian atas).
        </p>
      </Section>
    </LegalPage>
  );
}
