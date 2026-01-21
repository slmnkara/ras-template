/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./public/**/*.{html,js}"],
    theme: {
        extend: {
            colors: {
                primary: { DEFAULT: '#4f46e5', hover: '#4338ca', light: '#eef2ff' },
                success: { DEFAULT: '#22c55e', light: '#dcfce7' },
                danger: { DEFAULT: '#ef4444', light: '#fef2f2' },
                warning: { DEFAULT: '#f59e0b', light: '#fffbeb' },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
