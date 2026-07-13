import { Skeleton, Tag } from 'antd'
import { useGetBalanceSheetQuery } from '../accountingApi'
import { GroupBlock, Row, Statement } from './StatementView'

function BalanceSheetPage() {
  const { data, isLoading } = useGetBalanceSheetQuery()

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>
            Balance Sheet{' '}
            {data && (
              <Tag color={data.balanced ? 'green' : 'red'}>
                {data.balanced ? 'Balanced' : 'Out of balance'}
              </Tag>
            )}
          </h1>
          <p>Assets = Liabilities + Equity, as of today.</p>
        </div>
      </div>

      {isLoading || !data ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <Statement>
          <GroupBlock group={data.assets} />
          <Row label="Total Assets" amount={data.totalAssets} strong top />

          <div style={{ height: 18 }} />

          <GroupBlock group={data.liabilities} />
          <GroupBlock group={data.equity} />
          <Row label="Net income for the period" amount={data.netIncome} muted />
          <Row
            label="Total Liabilities + Equity"
            amount={data.totalLiabilitiesEquity}
            strong
            top
          />
        </Statement>
      )}
    </div>
  )
}

export default BalanceSheetPage
