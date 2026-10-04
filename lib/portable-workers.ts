// Standard module workers supported by Next.js/Webpack and Vite.
export const gfsWorker = class { constructor() { return new Worker(new URL('../components/gfs.worker.ts', import.meta.url), { type: 'module' }); } } as unknown as { new(): Worker };
export const era5Worker = class { constructor() { return new Worker(new URL('../components/era5.worker.ts', import.meta.url), { type: 'module' }); } } as unknown as { new(): Worker };
export const raw_gribWorker = class { constructor() { return new Worker(new URL('../components/raw-grib.worker.ts', import.meta.url), { type: 'module' }); } } as unknown as { new(): Worker };
export const iconWorker = class { constructor() { return new Worker(new URL('../components/icon.worker.ts', import.meta.url), { type: 'module' }); } } as unknown as { new(): Worker };
export const jmaWorker = class { constructor() { return new Worker(new URL('../components/jma.worker.ts', import.meta.url), { type: 'module' }); } } as unknown as { new(): Worker };
export const gepsWorker = class { constructor() { return new Worker(new URL('../components/geps.worker.ts', import.meta.url), { type: 'module' }); } } as unknown as { new(): Worker };
