export async function resolve(specifier, context, nextResolve) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !pathHasExtension(specifier))
    return nextResolve(`${specifier}.ts`, context)
  return nextResolve(specifier, context)
}

function pathHasExtension(specifier) {
  const path = specifier.split('?')[0]
  return /\.[a-z0-9]+$/i.test(path)
}
