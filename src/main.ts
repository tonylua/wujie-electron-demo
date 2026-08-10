import { createApp } from 'vue'
import WujieVue from 'wujie-vue3'
import App from './App.vue'

// Register wujie-vue3 plugin — makes <WujieVue> available globally
createApp(App).use(WujieVue).mount('#app')
