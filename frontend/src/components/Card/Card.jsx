import React from "react";
import styles from './Card.module.css';
import upSeal from "../../assets/UP-Seal.png"

export default function Card({ title, description, children, className }) {
    return (
        <div className={`${styles.card} ${className || ''}`}>
            <div className={styles.logo}>
                <img src={upSeal} alt="UP Seal" />
                <div className={styles.logoText}>
                    <p>
                        University of the Philippines
                    </p>
                    <p>
                        TACLOBAN COLLEGE
                    </p>
                </div>
            </div>
            <div className={styles.cardContent}>
                <div className={styles.cardTitle}>{title}</div>
                <div className={styles.cardDescription}>{description}</div>
                {children}
            </div>
        </div>
    );
}
