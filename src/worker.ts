import { inspect, processPDF, splitPDF } from './engine'
self.onmessage = async event => {
  const { inputs, operation, options, extra } = event.data
  try {
    if (operation === 'inspect' || operation === 'forms') self.postMessage({ report: await inspect(inputs[0]) })
    else if (operation === 'split') self.postMessage({ files: await splitPDF(inputs[0], options.pages) })
    else self.postMessage({ bytes: await processPDF(inputs, operation, options, extra) })
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'PDF processing failed.' }) }
}