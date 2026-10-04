declare module '*?worker' {
 const WorkerConstructor: {new(options?:WorkerOptions):Worker};
 export default WorkerConstructor;
}
declare module 'seek-bzip' {
 const Bunzip: {decode(bytes:Uint8Array):Uint8Array};
 export default Bunzip;
}
