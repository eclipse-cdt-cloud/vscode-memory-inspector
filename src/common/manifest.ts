/********************************************************************************
 * Copyright (C) 2022 Ericsson, Arm and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

// Common
export const PACKAGE_NAME = 'memory-inspector';
export const DISPLAY_NAME = 'Memory Inspector';
export const EDITOR_NAME = `${PACKAGE_NAME}.inspect`;

// Misc
export const CONFIG_LOGGING_VERBOSITY = 'loggingVerbosity';
export const DEFAULT_LOGGING_VERBOSITY = 'warn';
export const CONFIG_DEBUG_TYPES = 'debugTypes';
export const DEFAULT_DEBUG_TYPES = ['gdb', 'embedded-debug', 'arm-debugger'];

// MAUs (Minimum Addressable Units)
// - Bytes per MAU
export const CONFIG_BYTES_PER_MAU = 'groupings.bytesPerMAU';
export const CONFIG_BYTES_PER_MAU_CHOICES = [1, 2, 4, 8, 16] as const;
export const DEFAULT_BYTES_PER_MAU = 1;

// - MAU per Group
export const CONFIG_MAUS_PER_GROUP = 'groupings.MAUsPerGroup';
export const CONFIG_MAUS_PER_GROUP_CHOICES = [1, 2, 4, 8, 16] as const;
export const DEFAULT_MAUS_PER_GROUP = 1;

// - Groups per Row
export const CONFIG_GROUPS_PER_ROW = 'groupings.groupsPerRow';
export const CONFIG_GROUPS_PER_ROW_NUMERIC_CHOICES = [1, 2, 4, 8, 16, 32] as const;
export const CONFIG_GROUPS_PER_ROW_CHOICES = ['Autofit', ...CONFIG_GROUPS_PER_ROW_NUMERIC_CHOICES] as const;
export type GroupsPerRowOption = (typeof CONFIG_GROUPS_PER_ROW_CHOICES)[number];
export const DEFAULT_GROUPS_PER_ROW: GroupsPerRowOption = 4;

// - Group Endianness
export const CONFIG_ENDIANNESS = 'endianness';
export const ENDIANNESS_CHOICES = ['Little Endian', 'Big Endian'] as const;
export type Endianness = (typeof ENDIANNESS_CHOICES)[number];
export const DEFAULT_ENDIANNESS: Endianness = 'Little Endian';

// Refresh: On Stop
export const CONFIG_REFRESH_ON_STOP = 'refreshOnStop';
export const REFRESH_ON_STOP = ['on', 'off'] as const;
export type RefreshOnStop = (typeof REFRESH_ON_STOP)[number];
export const DEFAULT_REFRESH_ON_STOP = 'on';

// Refresh: Periodic
export const CONFIG_PERIODIC_REFRESH = 'periodicRefresh';
export const PERIODIC_REFRESH_CHOICES = ['always', 'while running', 'off'] as const;
export type PeriodicRefresh = (typeof PERIODIC_REFRESH_CHOICES)[number];
export const DEFAULT_PERIODIC_REFRESH: PeriodicRefresh = 'always';
export const CONFIG_PERIODIC_REFRESH_INTERVAL = 'periodicRefreshInterval';
export const DEFAULT_PERIODIC_REFRESH_INTERVAL = 500;

// Scroll
export const CONFIG_SCROLLING_BEHAVIOR = 'scrollingBehavior';
export const DEFAULT_SCROLLING_BEHAVIOR = 'Paginate';
export const CONFIG_ADDRESS_PADDING = 'addressPadding';
export const DEFAULT_ADDRESS_PADDING = 'Minimal';
export const CONFIG_ADDRESS_RADIX = 'addressRadix';
export const DEFAULT_ADDRESS_RADIX = 16;
export const CONFIG_SHOW_RADIX_PREFIX = 'showRadixPrefix';
export const DEFAULT_SHOW_RADIX_PREFIX = true;

// Columns
export const CONFIG_SHOW_VARIABLES_COLUMN = 'variables';
export const CONFIG_SHOW_ASCII_COLUMN = 'ascii';
export const DEFAULT_VISIBLE_COLUMNS = [CONFIG_SHOW_VARIABLES_COLUMN, CONFIG_SHOW_ASCII_COLUMN];

// Extension Settings
export const CONFIG_ALLOW_DEBUGGER_OVERWRITE_SETTINGS = 'allowDebuggerOverwriteSettings';
