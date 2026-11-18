'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="loading-screen">
      <h1>তথ্য দেখাতে সমস্যা হয়েছে</h1>
      <p>আপনার খসড়া ফোনে রাখা আছে। আবার চেষ্টা করুন।</p>
      <button className="button primary" onClick={reset}>
        আবার চেষ্টা করুন / Try again
      </button>
    </main>
  );
}
