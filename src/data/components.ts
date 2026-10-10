import type { ComponentStatus } from '@/types'

export interface FlowStage {
  id: string
  label: string
  short: string
  description: string
}

/**
 * Signal-flow stages. Ordered left → right as displayed in the diagram.
 * Descriptions describe intended behaviour — nothing here claims verified
 * electrical performance.
 */
export const FLOW_STAGES: FlowStage[] = [
  {
    id: 'battery',
    label: 'Battery under test',
    short: 'BATTERY',
    description:
      'The battery placed in the test fixture. Its terminals provide the voltage and (with the planned load stage) the discharge current that the system measures.',
  },
  {
    id: 'probes',
    label: 'Test probes / clips',
    short: 'PROBES',
    description:
      'Red and black clips or probes make the physical connection between the battery terminals and the measurement front-end. Good, low-resistance contact is essential for repeatable measurements.',
  },
  {
    id: 'sensing',
    label: 'Voltage / current sensing',
    short: 'SENSING',
    description:
      'A voltage-sensing circuit scales the battery voltage into the ADC range, and a current-sensing element converts load current into a measurable signal. Exact resistor values and sensor parts are still being selected.',
  },
  {
    id: 'mcu',
    label: 'ESP32 + ADS1115 interface',
    short: 'ESP32 + ADC',
    description:
      'The ESP32 DevKit V1 reads the conditioned signals through the ADS1115 external ADC over I2C, timestamps the values, and can show a live reading on an I2C OLED.',
  },
  {
    id: 'processing',
    label: 'Measurement processing',
    short: 'PROCESSING',
    description:
      'Firmware and the dashboard validate incoming values (range checks, staleness, missing fields) and aggregate them into samples, statistics, and completeness figures for the report.',
  },
  {
    id: 'display',
    label: 'Display / dashboard',
    short: 'DASHBOARD',
    description:
      'This web dashboard renders the measurements, charts, and reports, and stores test history locally. A MicroSD module is planned for logging directly on the device.',
  },
]

export interface TechComponent {
  id: string
  name: string
  category: 'controller' | 'sensing' | 'output' | 'mechanical' | 'storage' | 'software'
  purpose: string
  signalRole: string
  status: ComponentStatus
  statusNote: string
  /** Index into FLOW_STAGES */
  flowStage: number
}

export const STATUS_LABEL: Record<ComponentStatus, string> = {
  planned: 'Planned',
  'in-development': 'Under development',
  implemented: 'Implemented',
  connected: 'Connected',
}

/**
 * Honest component list. Status labels follow the project rule:
 * "Implemented" is only used when something is confirmed to exist and run;
 * "Connected" is only used when actual connectivity has been verified.
 */
export const TECH_COMPONENTS: TechComponent[] = [
  {
    id: 'esp32',
    name: 'ESP32 DevKit V1',
    category: 'controller',
    purpose:
      'Primary controller. Reads the ADC, timestamps measurements, drives the OLED, and (planned) writes logs to the MicroSD module.',
    signalRole: 'Digital hub: I2C master to the ADS1115 and OLED; serial/USB bridge to the dashboard.',
    status: 'in-development',
    statusNote: 'Controller selected and bring-up in progress. Firmware for validated acquisition is not finished.',
    flowStage: 3,
  },
  {
    id: 'ads1115',
    name: 'ADS1115 external ADC',
    category: 'sensing',
    purpose:
      '16-bit I2C ADC intended to give cleaner, more repeatable analog voltage readings than the ESP32’s internal ADC.',
    signalRole: 'Analog → digital: converts the conditioned voltage/current signals over I2C.',
    status: 'in-development',
    statusNote: 'Module selected; gain/rate configuration and calibration are not yet validated.',
    flowStage: 3,
  },
  {
    id: 'voltage-sensing',
    name: 'Voltage-sensing circuit',
    category: 'sensing',
    purpose:
      'Scales the battery voltage (e.g. a 12 V block) into the ADC’s measurable range while protecting the inputs.',
    signalRole: 'Passive conditioning: high-side divider feeding the ADC input.',
    status: 'in-development',
    statusNote: 'Topology chosen; exact resistor values and input protection are not finalised. No published ratings.',
    flowStage: 2,
  },
  {
    id: 'current-sensor',
    name: 'Current sensor',
    category: 'sensing',
    purpose:
      'Converts the test current into a measurable signal so discharge/response behaviour can be studied, not just open-circuit voltage.',
    signalRole: 'Current → voltage (shunt or hall sensor — selection open).',
    status: 'planned',
    statusNote: 'Sensor family not finalised; shunt vs. hall decision pending on the load-stage design.',
    flowStage: 2,
  },
  {
    id: 'temp-sensor',
    name: 'Temperature sensor',
    category: 'sensing',
    purpose:
      'Tracks battery temperature during a test so heating can be observed and safety limits respected.',
    signalRole: 'Thermal → digital (I2C/1-wire candidate).',
    status: 'planned',
    statusNote: 'Sensor not yet selected or mounted.',
    flowStage: 2,
  },
  {
    id: 'oled',
    name: 'I2C OLED display',
    category: 'output',
    purpose:
      'On-device readout of the live measurement so the tester works standalone, without a computer.',
    signalRole: 'Output: renders voltage/current/temperature from the ESP32 over I2C.',
    status: 'planned',
    statusNote: 'Display chosen visually for the enclosure; driver firmware not written yet.',
    flowStage: 5,
  },
  {
    id: 'load-stage',
    name: 'Controlled-load stage',
    category: 'mechanical',
    purpose:
      'Proposed stage that would draw a controlled current so the battery’s response under load can be characterised. This is what a Start command would eventually drive — only after validated firmware and electrical protection exist.',
    signalRole: 'Actuator: controlled sink switched by the ESP32 with hardware protection.',
    status: 'planned',
    statusNote:
      'Design proposal only. The web dashboard deliberately cannot activate any physical load.',
    flowStage: 2,
  },
  {
    id: 'probes',
    name: 'Battery clips & probes',
    category: 'mechanical',
    purpose:
      'Red/black clips and probes that connect the battery terminals to the sensing front-end.',
    signalRole: 'Physical interface: carries the measurement path to the battery.',
    status: 'planned',
    statusNote: 'Standard clip hardware intended; contact-resistance impact not yet characterised.',
    flowStage: 1,
  },
  {
    id: 'microsd',
    name: 'MicroSD logging module',
    category: 'storage',
    purpose:
      'Logs measurements on the device itself so tests can run without a computer attached.',
    signalRole: 'Storage: SPI file writes from the ESP32.',
    status: 'planned',
    statusNote:
      'Card records will only appear in the dashboard after an explicit import/transfer step — never automatically.',
    flowStage: 5,
  },
  {
    id: 'dashboard',
    name: 'Computer dashboard (this software)',
    category: 'software',
    purpose:
      'Runs the test workflow, renders charts and reports, stores history, and exports CSV. Built to ingest real hardware data through a documented JSON-line protocol.',
    signalRole: 'Consumes validated readings; produces reports and exports.',
    status: 'implemented',
    statusNote:
      'Software implemented and shipping in this prototype. The hardware data layer behind it is still under development — demo mode is clearly labelled.',
    flowStage: 5,
  },
]
