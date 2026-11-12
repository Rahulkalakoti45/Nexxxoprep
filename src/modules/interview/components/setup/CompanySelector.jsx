import { Segmented } from '../../../../components/ui/index.jsx'

const companies = ['Amazon', 'Google', 'Microsoft', 'TCS', 'Infosys', 'Wipro']

export default function CompanySelector({ value, onChange }) {
  return <Segmented label="Company" options={companies} value={value} onChange={onChange} />
}
