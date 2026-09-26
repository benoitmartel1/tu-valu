// A stable order (including a unique tie-breaker) is required in queryFactory.
export async function allRows(queryFactory, pageSize = 500) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await queryFactory().range(
      offset,
      offset + pageSize - 1,
    );
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}
