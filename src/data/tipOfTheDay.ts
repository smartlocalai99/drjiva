// One entry per tip graphic on file. Add a line here + drop the image in
// assets/tipoftheday/ as new tips are designed — the home screen rotates
// through whatever's listed here, one per calendar day, automatically.
const TIP_IMAGES: ReturnType<typeof require>[] = [
  require('../../assets/tipoftheday/tipoftheday1.jpg'),
];

export function getTodaysTipImage(): ReturnType<typeof require> {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor(
    (now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000),
  );
  return TIP_IMAGES[dayOfYear % TIP_IMAGES.length];
}
