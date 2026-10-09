// Test double for runProcess. Behaviour depends on the first argument.
const mode = process.argv[2];

if (mode === 'lines') {
  process.stdout.write('DT_PROGRESS downloading|1|2|NA|NA|NA|137\npart');
  setTimeout(() => {
    process.stdout.write('ial line\n');
    process.stderr.write('DT_PP Merger|started\nwarning: türkçe çıktı\n');
  }, 30);
} else if (mode === 'json') {
  process.stdout.write(JSON.stringify({ title: 'Gülümse', n: 1 }));
} else if (mode === 'fail') {
  process.stderr.write('ERROR: [youtube] abc: Video unavailable\n');
  process.exitCode = 1;
} else if (mode === 'hang') {
  process.stdout.write('started\n');
  setInterval(() => {}, 1000);
} else if (mode === 'env') {
  process.stdout.write(`${process.env.PYTHONUTF8}|${process.env.PYTHONIOENCODING}\n`);
}
