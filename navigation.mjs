export function nextIcon(current) {
  return (current + 1) % 4;
}

export function pageFromUrl(url, availablePages = ['projects', 'oppo']) {
  const page = new URL(url).searchParams.get('page');
  return availablePages.includes(page) ? page : 'home';
}
