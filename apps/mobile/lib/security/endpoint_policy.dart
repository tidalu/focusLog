bool isFocusLogTrustedLocalEndpoint(Uri endpoint) {
  final host = endpoint.host.toLowerCase();
  return host == 'localhost' ||
      host == '127.0.0.1' ||
      host == '::1' ||
      host.endsWith('.localhost');
}

Uri requireFocusLogSafeEndpoint(Uri endpoint) {
  if (endpoint.scheme == 'https') return endpoint;
  if (endpoint.scheme == 'http' && isFocusLogTrustedLocalEndpoint(endpoint)) {
    return endpoint;
  }
  throw ArgumentError.value(
    endpoint.toString(),
    'endpoint',
    'FocusLog mobile network endpoints must use HTTPS except trusted localhost development endpoints.',
  );
}
