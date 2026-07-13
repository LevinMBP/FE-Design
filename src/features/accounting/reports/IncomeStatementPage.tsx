import { Skeleton } from 'antd'
import { useGetIncomeStatementQuery } from '../accountingApi'
import { GroupBlock, Row, Statement } from './StatementView'

function IncomeStatementPage() {
  const { data, isLoading } = useGetIncomeStatementQuery()

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Income Statement</h1>
          <p>Revenue less expenses over the period.</p>
        </div>
      </div>

      {isLoading || !data ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        <Statement>
          <GroupBlock group={data.income} />
          <GroupBlock group={data.expenses} />
          <Row label="Net Income" amount={data.netIncome} strong top />
        </Statement>
      )}
    </div>
  )
}

export default IncomeStatementPage
