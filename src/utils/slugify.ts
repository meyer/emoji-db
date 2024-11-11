export const slugify = (str: string) =>
  str
    .toLowerCase()
    .replace(/['\u{2019}]/gu, '')
    // https://stackoverflow.com/a/37511463
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace('*', 'asterisk')
    .replace('\u0023', 'hash')
    .replace(' & ', ' and ')
    .replace(/[^\w\-]+/g, '_')
    .replace(/^_+|_+$/g, '');
