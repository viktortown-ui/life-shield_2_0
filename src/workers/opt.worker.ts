self.onmessage = (event: MessageEvent<{ input: string }>) => {
  const { input } = event.data;
  self.postMessage({ status: 'stub', input });
};
