import type { Lang } from './types';
export function humanError(lang: Lang, message: string) {
  if (lang === 'en') return message;
  const mappings: [RegExp, string][] = [
    [
      /Invalid login credentials|Phone or password is incorrect/i,
      'ইমেইল / ফোন অথবা পাসওয়ার্ড সঠিক নয়। আবার যাচাই করুন।',
    ],
    [/already registered/i, 'এই ইমেইলে অ্যাকাউন্ট আছে। প্রবেশ করুন বা পাসওয়ার্ড পরিবর্তন করুন।'],
    [/Too many|rate limit/i, 'অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।'],
    [/Sign in|session.*inactive/i, 'আবার অ্যাকাউন্টে প্রবেশ করুন।'],
    [/Owner access|Only the owner/i, 'এই কাজটি শুধু মালিক করতে পারবেন।'],
    [/own expenses/i, 'শুধু নিজের খরচ লিখতে বা সংশোধন করতে পারবেন।'],
    [/closed programs/i, 'সম্পন্ন প্রোগ্রামে পরিবর্তনের জন্য মালিকের সাথে যোগাযোগ করুন।'],
    [
      /changed on another device|latest version/i,
      'অন্য ডিভাইসে তথ্য বদলেছে। সর্বশেষ তথ্য দেখে আবার চেষ্টা করুন।',
    ],
    [/already billed/i, 'নির্বাচিত প্রোগ্রামের বিল আগে তৈরি হয়েছে।'],
    [/already received/i, 'এই বিলের টাকা প্রাপ্তি আগে সংরক্ষণ হয়েছে।'],
    [/receiving information|receiving quantities/i, 'সব ট্রাকের প্রাপ্তির তারিখ, বস্তা ও ওজন লিখুন।'],
    [/Net weight cannot exceed/i, 'নেট ওজন গ্রস ওজনের বেশি হতে পারে না।'],
    [/Receipt cannot be before/i, 'প্রাপ্তির তারিখ প্রেরণের তারিখের আগে হতে পারে না।'],
    [/positive dispatch quantities/i, 'প্রেরিত বস্তা ও ওজন শূন্যের বেশি লিখুন।'],
    [/positive.*rate/i, 'প্রতিটি প্রোগ্রামের সঠিক টনপ্রতি দর লিখুন।'],
    [/Tax.*exceed|Tax must be|tax.*negative/i, 'আয়কর শূন্য থেকে সমন্বিত বিলের পরিমাণের মধ্যে হতে হবে।'],
    [/Deductions exceed/i, 'কর্তনের পরিমাণ প্রোগ্রামের বিলের চেয়ে বেশি। যাচাই করুন।'],
    [
      /Actual receipt.*match|Net receipt must match/i,
      'প্রাপ্ত টাকা হিসাবের সাথে মিলছে না। কর ও সমন্বয় যাচাই করুন।',
    ],
    [/positive amount/i, 'শূন্যের বেশি টাকার পরিমাণ লিখুন। শুরুর জের ঋণাত্মক হতে পারে।'],
    [/reason.*adjustment|reason.*correction|Enter a reason/i, 'এই পরিবর্তন বা খরচের কারণ লিখুন।'],
    [/different receiving staff/i, 'টাকা দেওয়ার জন্য অন্য একজন কর্মী নির্বাচন করুন।'],
    [/active expense head/i, 'সক্রিয় একটি খরচের খাত নির্বাচন করুন।'],
    [/not in your organization/i, 'আপনার প্রতিষ্ঠানের ফার্ম, প্রোগ্রাম বা কর্মী নির্বাচন করুন।'],
    [
      /connection|network|Failed to fetch|fetch failed/i,
      'ইন্টারনেট সংযোগ যাচাই করে আবার চেষ্টা করুন। আপনার খসড়া ফোনে রাখা আছে।',
    ],
  ];
  return mappings.find(([pattern]) => pattern.test(message))?.[1] || message;
}
