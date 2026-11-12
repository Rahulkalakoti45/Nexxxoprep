import { Segmented } from '../../../../components/ui/index.jsx'

const roles = ['SDE', 'Frontend Developer', 'Backend Developer', 'Data Analyst', 'Product Manager', 'HR']

export default function RoleSelector({ value, onChange }) {
  return <Segmented label="Role" options={roles} value={value} onChange={onChange} />
}
