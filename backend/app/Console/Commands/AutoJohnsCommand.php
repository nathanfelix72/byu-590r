<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class AutoJohnsCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'auto:johns-command';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'This command runs johns command. Rodger!';

    /**
     * Execute the console command.
     *
     * @return int
     */
    public function handle()
    {
        $this->info('I am here!');
        return Command::SUCCESS;
    }
}

