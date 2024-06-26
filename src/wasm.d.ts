declare module '*.wasm' {
  const promise: (imports: WebAssembly.Imports) => Promise<WebAssembly.WebAssemblyInstantiatedSource>;
  export default promise;
}
