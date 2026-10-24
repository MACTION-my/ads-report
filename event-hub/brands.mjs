// Keep old persisted IDs and snapshots compatible while using the current brand name.
export const canonicalBrand=brand=>brand==='Chain'?'Franchise':brand;
export const canonicalEvent=event=>({...event,brand:canonicalBrand(event.brand),name:typeof event.name==='string'?event.name.replace(/^Chain\b/i,'Franchise'):event.name});
