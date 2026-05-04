import Card from "../../components/Card/Card";
import LogoutButton from "../../components/LogoutButton.jsx"
import styles from './DashboardLayout.module.css'

function DashboardLayout({ sidebar, children }) {
    return (
        <div className={styles.container}>
            <Card
                className={styles.votingPageCard}
                title="UniVote"
                description="University-wide Student Council Election Management System"
            >
                <div className={styles.menu}>
                    {sidebar}
                </div>
            </Card>

            <div className={styles.mainContent}>
                {children}
            </div>
            <LogoutButton />
        </div>
    );
}

export default DashboardLayout
