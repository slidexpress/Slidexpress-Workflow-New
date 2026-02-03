const formatNameLastFirst = (name) => {
  if (!name || !name.trim()) return '';
  const trimmed = name.trim().replace(/,+$/, '');
  if (trimmed.includes(',')) {
    const [part1, part2] = trimmed.split(',').map(s => s.trim());
    return `${part2}, ${part1}`;
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0];
  const lastName = parts.pop();
  const firstName = parts.join(' ');
  return `${lastName}, ${firstName}`;
};

console.log('Test 1: "Laura Amoros" =>', formatNameLastFirst('Laura Amoros'));
console.log('Test 2: "Laura, Amoros" =>', formatNameLastFirst('Laura, Amoros'));
console.log('Test 3: "Amoros, Laura" =>', formatNameLastFirst('Amoros, Laura'));
